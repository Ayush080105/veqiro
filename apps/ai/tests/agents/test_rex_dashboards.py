"""Rex dashboards: several datasets in one DuckDB, filters as views, and the generate/run flow
with the model stubbed out."""
import asyncio

import pytest

from agents.rex import dashboards as dash
from agents.rex import dataset_sql as d

SALES = {
    "headers": ["Order Date", "Region", "Amount"],
    "columnTypes": {"Order Date": "date", "Region": "categorical", "Amount": "numeric"},
    "rows": [
        {"Order Date": "2026-01-05", "Region": "North", "Amount": "₹1,000"},
        {"Order Date": "2026-02-10", "Region": "South", "Amount": "2,000"},
        {"Order Date": "2026-03-20", "Region": "North", "Amount": "500"},
        {"Order Date": "2026-03-28", "Region": "O'Brien", "Amount": "50"},
    ],
}
COSTS = {
    "headers": ["Month", "Cost"],
    "columnTypes": {"Month": "text", "Cost": "numeric"},
    "rows": [{"Month": "Jan", "Cost": "300"}, {"Month": "Feb", "Cost": "400"}],
}
WORKBOOK = {
    "headers": [], "rows": [], "columnTypes": {},
    "sheets": {"Q1 Sales": SALES, "Costs": COSTS},
}


def _load(*sources):
    return asyncio.run(d.load_sources([{"alias": a, "table": t} for a, t in sources]))


def _q(ds, sql):
    return asyncio.run(d.run(ds, sql)).rows


def test_each_dataset_is_its_own_table_and_sheets_get_suffixed():
    ds = _load(("sales", SALES), ("book", WORKBOOK))
    assert set(ds.tables) == {"sales", "book__q1_sales", "book__costs"}
    assert _q(ds, 'SELECT sum("Amount") FROM sales') == [[3550.0]]
    assert _q(ds, 'SELECT sum("Cost") FROM book__costs') == [[700.0]]
    assert 'TABLE "sales"' in ds.schema_text and "_base_" not in ds.schema_text


def test_category_filter_narrows_the_view_and_escapes_quotes():
    ds = _load(("sales", SALES))
    flt = [{"id": "f1", "table": "sales", "column": "Region", "type": "category"}]
    d.apply_filters(ds, flt, {"f1": "North"})
    assert _q(ds, 'SELECT sum("Amount") FROM sales') == [[1500.0]]
    d.apply_filters(ds, flt, {"f1": "O'Brien"})
    assert _q(ds, 'SELECT count(*) FROM sales') == [[1]]
    d.apply_filters(ds, flt, {"f1": "x') OR 1=1 --"})   # a viewer-supplied value stays a value
    assert _q(ds, 'SELECT count(*) FROM sales') == [[0]]
    d.apply_filters(ds, flt, {})
    assert _q(ds, 'SELECT count(*) FROM sales') == [[4]]


def test_date_preset_is_anchored_on_the_latest_date_in_the_data():
    ds = _load(("sales", SALES))
    flt = [{"id": "d", "table": "sales", "column": "Order Date", "type": "date_range"}]
    d.apply_filters(ds, flt, {"d": "last_30d"})
    assert _q(ds, 'SELECT count(*) FROM sales') == [[2]]   # 20 and 28 March
    d.apply_filters(ds, flt, {"d": "nonsense"})
    assert _q(ds, 'SELECT count(*) FROM sales') == [[4]]


def test_model_sql_still_cannot_escape_after_views_exist():
    ds = _load(("sales", SALES))
    with pytest.raises(d.UnsafeSQL):
        _q(ds, "SELECT * FROM read_csv('/etc/passwd')")
    with pytest.raises(d.UnsafeSQL):
        _q(ds, "CREATE VIEW sales AS SELECT 1")


def test_filter_options_lists_values_or_gives_up_when_there_are_too_many():
    ds = _load(("sales", SALES))
    assert d.filter_options(ds, {"table": "sales", "column": "Region"}) == ["North", "O'Brien", "South"]
    assert d.filter_options(ds, {"table": "sales", "column": "Region"}, limit=2) is None


class _StubLLM:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = 0
        self.prompts: list[str] = []

    async def complete_json(self, messages=(), **_):
        self.calls += 1
        self.prompts.append(messages[-1]["content"] if messages else "")
        return self.replies.pop(0)

    def count_tokens(self, _):
        return 1


class _StubAgent:
    default_provider = "stub"
    default_model = "stub"

    async def build_system_prompt(self, *_, **__):
        return ""


@pytest.fixture
def stub(monkeypatch):
    def _install(*replies):
        llm = _StubLLM(replies)
        monkeypatch.setattr(dash, "_llm", llm)
        monkeypatch.setattr(dash, "_agent", _StubAgent())
        monkeypatch.setattr(dash.settings, "MOCK_MODE", False)
        return llm
    return _install


def _gen(prompt="revenue by region"):
    return asyncio.run(dash.generate(dash.GenerateRequest(
        user_id="u", prompt=prompt, sources=[dash.Source(alias="sales", table=SALES)])))


def test_generate_runs_every_widget_fixes_once_and_drops_what_still_fails(stub):
    spec = {
        "title": "Sales",
        "filters": [{"id": "f1", "label": "Region", "table": "sales", "column": "Region", "type": "category"},
                    {"id": "f2", "label": "Bad", "table": "sales", "column": "Region", "type": "date_range"}],
        "widgets": [
            {"id": "k", "kind": "kpi", "title": "Revenue", "sql": 'SELECT sum("Amount") AS rev FROM sales',
             "kpi": {"valueKey": "revenue"}, "filterIds": ["f1", "f2"]},
            {"id": "c", "kind": "chart", "title": "By region",
             "sql": 'SELECT "Region" AS region, sum("Amount") AS rev FROM sales GROUP BY 1',
             "chart": {"type": "bar", "xKey": "region", "yKeys": [{"key": "rev"}]}},
            {"id": "broken", "kind": "chart", "title": "Broken", "sql": 'SELECT "Nope" FROM sales'},
            {"id": "fixed", "kind": "table", "title": "Fixable", "sql": 'SELECT "Amt" FROM sales'},
        ],
    }
    fix = {"widgets": [{"id": "broken", "sql": 'SELECT "Still Nope" FROM sales'},
                       {"id": "fixed", "sql": 'SELECT "Amount" FROM sales LIMIT 2'}]}
    llm = stub(spec, fix)
    out = _gen()
    assert llm.calls == 2
    ids = [w.id for w in out.dashboard.widgets]
    assert ids == ["k", "c", "fixed"]
    assert [x["title"] for x in out.dropped] == ["Broken"]
    # The date_range on a text column is dropped; the category filter carries its options.
    assert [f.id for f in out.dashboard.filters] == ["f1"]
    assert out.dashboard.filters[0].options == ["North", "O'Brien", "South"]
    kpi = out.dashboard.widgets[0]
    assert kpi.spec["kpi"]["valueKey"] == "rev"      # fitted to the column that exists
    assert kpi.filterIds == ["f1"]
    chart = out.dashboard.widgets[1]
    assert chart.spec["chart"]["yKeys"][0]["color"]
    assert all(w.layout for w in out.dashboard.widgets)
    assert kpi.layout == {"x": 0, "y": 0, "w": 3, "h": 2}


def test_generate_falls_back_to_a_true_dashboard_when_nothing_runs(stub):
    stub({"title": "x", "widgets": [{"id": "a", "kind": "table", "title": "a", "sql": "SELECT nope"}]},
         {"widgets": []})
    out = _gen()
    assert out.dashboard.widgets
    assert [x["title"] for x in out.dropped] == ["a"]
    assert out.results[0].rows[0]["rows"] == 4


def test_edit_keeps_layout_and_reverts_a_change_that_breaks(stub):
    current = dash.DashboardSpec(title="Sales", widgets=[
        dash.Widget(id="k", kind="kpi", title="Revenue", sql='SELECT sum("Amount") AS rev FROM sales',
                    spec={"kpi": {"valueKey": "rev", "prefix": "₹"}, "size": "s"},
                    layout={"x": 6, "y": 3, "w": 3, "h": 2}),
    ])
    revised = {"title": "Sales", "widgets": [
        {"id": "k", "kind": "kpi", "title": "Revenue", "sql": 'SELECT sum("Bad") FROM sales'},
        {"id": "new", "kind": "chart", "title": "Trend",
         "sql": 'SELECT "Order Date" AS d, "Amount" AS amt FROM sales ORDER BY 1',
         "chart": {"type": "line", "xKey": "d", "yKeys": [{"key": "amt"}]}},
    ]}
    stub(revised, {"widgets": []})
    out = asyncio.run(dash.edit(dash.EditRequest(
        user_id="u", prompt="add a trend", dashboard=current,
        sources=[dash.Source(alias="sales", table=SALES)])))
    k, new = out.dashboard.widgets
    assert k.sql == 'SELECT sum("Amount") AS rev FROM sales'        # reverted
    assert k.layout == {"x": 6, "y": 3, "w": 3, "h": 2}              # kept its place
    assert k.spec["kpi"]["prefix"] == "₹"                            # kept manual settings
    assert new.layout["y"] == 5                                      # placed below
    assert "reverted" in out.dropped[0]["error"]


def test_run_applies_only_the_filters_each_widget_subscribes_to():
    req = dash.RunRequest(
        sources=[dash.Source(alias="sales", table=SALES)],
        filters=[dash.FilterDef(id="f1", label="Region", table="sales", column="Region")],
        widgets=[
            dash.Widget(id="a", kind="kpi", title="a", sql='SELECT sum("Amount") AS v FROM sales', filterIds=["f1"]),
            dash.Widget(id="b", kind="kpi", title="b", sql='SELECT sum("Amount") AS v FROM sales'),
            dash.Widget(id="t", kind="text", title="t", spec={"text": "hi"}),
        ],
        states=[dash.RunState(), dash.RunState(key="north", values={"f1": "North"})],
    )
    out = asyncio.run(dash.run(req))
    got = {(r.widget_id, r.state_key): (r.rows[0]["v"] if r.rows else None) for r in out.results}
    assert got[("a", "all")] == 3550 and got[("a", "north")] == 1500
    assert got[("b", "north")] == 3550
    assert got[("t", "north")] is None
    assert out.filter_options["f1"] == ["North", "O'Brien", "South"]


# ── Richer tile forms ────────────────────────────────────────────────────────

def _fit(kind, chart_or_kpi, columns, rows):
    w = dash.Widget(id="w", kind=kind, title="t", sql="SELECT 1",
                    spec={kind if kind == "kpi" else "chart": chart_or_kpi})
    dash.fit_spec(w, dash.WidgetResult(widget_id="w", columns=columns, rows=rows))
    return w.spec["kpi" if kind == "kpi" else "chart"]


def test_trend_kpi_keeps_its_period_and_a_single_row_kpi_drops_it():
    rows = [{"month": "2026-01", "rev": 10}, {"month": "2026-02", "rev": 12}]
    kpi = _fit("kpi", {"valueKey": "rev", "periodKey": "mnth", "goodDirection": "sideways"}, ["month", "rev"], rows)
    assert kpi["periodKey"] == "month" and kpi["goodDirection"] == "up"
    one = _fit("kpi", {"valueKey": "rev", "periodKey": "month"}, ["rev"], [{"rev": 5}])
    assert "periodKey" not in one


def test_series_get_palette_slots_not_hex_and_a_null_first_row_still_counts_as_numeric():
    chart = _fit("chart", {"type": "line"}, ["d", "a", "b"],
                 [{"d": "x", "a": None, "b": 1}, {"d": "y", "a": 2, "b": 3}])
    assert [y["key"] for y in chart["yKeys"]] == ["a", "b"]
    assert [y["color"] for y in chart["yKeys"]] == ["s1", "s2"]


def test_heatmap_needs_two_dimensions_or_falls_back_to_bar():
    rows = [{"m": "Jan", "r": "N", "v": 1}, {"m": "Jan", "r": "S", "v": 2}]
    ok = _fit("chart", {"type": "heatmap", "xKey": "m", "groupKey": "zone"}, ["m", "r", "v"], rows)
    assert ok["type"] == "heatmap" and ok["groupKey"] == "r" and [y["key"] for y in ok["yKeys"]] == ["v"]
    flat = _fit("chart", {"type": "heatmap", "xKey": "m"}, ["m", "v"], [{"m": "Jan", "v": 1}])
    assert flat["type"] == "bar"


def test_progress_finds_the_target_column_and_never_invents_one():
    rows = [{"rep": "A", "won": 5, "deals": 9, "quota": 8}]
    chart = _fit("chart", {"type": "progress", "xKey": "rep", "yKeys": [{"key": "won"}]},
                 ["rep", "won", "deals", "quota"], rows)
    assert chart["targetKey"] == "quota" and [y["key"] for y in chart["yKeys"]] == ["won"]
    alone = _fit("chart", {"type": "progress", "xKey": "rep", "yKeys": [{"key": "won"}]},
                 ["rep", "won"], [{"rep": "A", "won": 5}])
    assert alone["type"] == "bar"


def test_combo_marks_each_series_and_single_measure_forms_keep_one():
    rows = [{"m": "Jan", "actual": 5, "plan": 6}]
    combo = _fit("chart", {"type": "combo", "xKey": "m"}, ["m", "actual", "plan"], rows)
    assert [y["as"] for y in combo["yKeys"]] == ["bar", "line"]
    fall = _fit("chart", {"type": "waterfall", "xKey": "m"}, ["m", "actual", "plan"], rows)
    assert [y["key"] for y in fall["yKeys"]] == ["actual"]
    assert _fit("chart", {"type": "sparkle"}, ["m", "actual"], rows)["type"] == "bar"


def test_generate_prompt_carries_the_chart_guide(stub):
    llm = stub({"title": "x", "widgets": [
        {"id": "f", "kind": "chart", "title": "Funnel", "chart": {"type": "funnel", "xKey": "region"},
         "sql": 'SELECT "Region" AS region, count(*) AS n FROM sales GROUP BY 1 ORDER BY 2 DESC'}]})
    out = _gen()
    assert "waterfall" in llm.prompts[0] and "{chart_guide}" not in llm.prompts[0]
    assert out.dashboard.widgets[0].spec["chart"]["type"] == "funnel"
