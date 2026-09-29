"""Rex dashboards: build a dashboard from a prompt over one or more datasets, edit it by prompt,
and compute every widget's result.

The model never produces numbers. It writes one read-only SQL query per widget plus how to show
the result; every query is run here against DuckDB (dataset_sql) and a widget whose query still
fails after one corrective round is dropped rather than shown broken. `/run` is the refresh path
the server calls whenever data changes — it makes no model calls, only queries, so a public
dashboard's numbers are always what the SQL computed.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter
from pydantic import BaseModel, Field

from agents.rex import dataset_sql
from agents.rex.routes import CHART_COLORS, _agent, _llm
from core.config import settings

logger = logging.getLogger("agents")

router = APIRouter(prefix="/ai/rex/dashboards", tags=["Rex dashboards"])

MAX_WIDGETS = 20
MAX_FILTERS = 3
GRID_COLS = 12
CHART_TYPES = {"bar", "line", "area", "pie", "scatter"}
KINDS = {"kpi", "chart", "table", "text"}
SIZES = {"s": (3, 2), "m": (6, 4), "l": (8, 4), "xl": (12, 5)}


# ── Models ───────────────────────────────────────────────────────────────────

class Source(BaseModel):
    alias: str
    name: str = ""
    table: dict = Field(default_factory=dict)   # the stored preview (rawTable)
    file_url: str | None = None
    file_name: str = ""


class FilterDef(BaseModel):
    id: str
    label: str
    table: str
    column: str
    type: str = "category"   # category | date_range
    options: list[str] | None = None


class Widget(BaseModel):
    id: str
    kind: str
    title: str
    sql: str | None = None
    spec: dict = Field(default_factory=dict)
    layout: dict | None = None
    filterIds: list[str] = Field(default_factory=list)


class WidgetResult(BaseModel):
    widget_id: str
    state_key: str = "all"
    columns: list[str] = Field(default_factory=list)
    rows: list[dict] = Field(default_factory=list)
    truncated: bool = False
    error: str | None = None


class DashboardSpec(BaseModel):
    title: str
    description: str = ""
    filters: list[FilterDef] = Field(default_factory=list)
    widgets: list[Widget] = Field(default_factory=list)


class GenerateRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    prompt: str
    sources: list[Source]


class EditRequest(GenerateRequest):
    dashboard: DashboardSpec
    widget_id: str | None = None   # the widget the instruction is about, if any


class DashboardResponse(BaseModel):
    dashboard: DashboardSpec
    results: list[WidgetResult]
    dropped: list[dict] = Field(default_factory=list)   # [{title, error}] widgets that never ran
    rows_used: int = 0
    whole_file: bool = True
    tokens_used: int = 0
    model_used: str = ""


class RunState(BaseModel):
    key: str = "all"
    values: dict = Field(default_factory=dict)   # filter id → value


class RunRequest(BaseModel):
    sources: list[Source]
    filters: list[FilterDef] = Field(default_factory=list)
    widgets: list[Widget]
    states: list[RunState] = Field(default_factory=lambda: [RunState()])


class RunResponse(BaseModel):
    results: list[WidgetResult]
    filter_options: dict[str, list[str] | None] = Field(default_factory=dict)
    rows_used: int = 0
    whole_file: bool = True


# ── Prompts ──────────────────────────────────────────────────────────────────

SPEC_SHAPE = """\
{{
  "title": "short dashboard title",
  "description": "one sentence",
  "filters": [ {{"id": "f1", "label": "Region", "table": "<table>", "column": "<column>",
                 "type": "category" | "date_range"}} ],
  "widgets": [
    {{"id": "w1", "kind": "kpi", "title": "Total revenue", "size": "s",
      "sql": "SELECT sum(\\"Amount\\") AS revenue FROM sales",
      "kpi": {{"valueKey": "revenue", "format": "number" | "currency" | "percent", "prefix": "₹", "suffix": ""}},
      "filterIds": ["f1"]}},
    {{"id": "w2", "kind": "chart", "title": "Revenue by month", "size": "m" | "l" | "xl",
      "sql": "SELECT strftime(date_trunc('month', \\"Order Date\\"), '%Y-%m') AS month, sum(\\"Amount\\") AS revenue FROM sales GROUP BY 1 ORDER BY 1",
      "chart": {{"type": "bar" | "line" | "area" | "pie" | "scatter", "xKey": "month",
                 "yKeys": [{{"key": "revenue", "label": "Revenue", "color": "<hex>"}}], "stacked": false}},
      "filterIds": ["f1"]}},
    {{"id": "w3", "kind": "table", "title": "Top 10 customers", "size": "l", "sql": "...", "filterIds": []}},
    {{"id": "w4", "kind": "text", "title": "Notes", "size": "m", "text": "markdown, only when asked"}}
  ]
}}"""

SQL_RULES = """\
SQL rules (every widget except text has exactly one query):
- One DuckDB SELECT (or WITH … SELECT). Read-only. Only the tables in the schema.
- Quote every column name with double quotes exactly as written, e.g. "Order Date".
- Filter on the exact values listed in the schema (they are case-sensitive).
- Numbers are already clean numerics; dates are DATE — use date_trunc/strftime/extract.
- Name every output column with a short snake_case alias; the chart/kpi keys must use those aliases.
- KPI queries return ONE row. Chart queries return at most 20 rows (group, then ORDER BY and LIMIT).
  Time series are ordered by time ascending. Tables return at most 50 rows.
- Tables from different datasets can be joined only on columns that genuinely match."""

GENERATE_PROMPT = """\
You are Rex, a data analyst building a live business dashboard for a customer.

Their data (each table below is one dataset or one sheet of it):
{schema}

What they want: {prompt}

Design a dashboard that answers what they asked, and nothing padded on. Typically 2-4 KPIs across
the top, then 3-6 charts, and a table only when row-level detail is genuinely useful. At most
{max_widgets} widgets. Pick the chart type that fits the data: line/area for time, bar for
comparing categories, pie only for share-of-total with 6 or fewer slices.

Add up to {max_filters} filters a viewer can use — a date_range on the main date column, and a
category filter on a column with a handful of meaningful values (region, product, channel).
A date_range filter must be on a DATE column. List the filter in the filterIds of every widget
whose table it applies to.

{sql_rules}

Colors: use these in order: {colors}.
Sizes: s = small KPI tile, m = half width, l = two-thirds, xl = full width.

Return JSON exactly in this shape:
{shape}"""

EDIT_PROMPT = """\
You are Rex, editing a customer's existing dashboard.

Their data:
{schema}

The dashboard now (JSON):
{current}
{focus}
The customer's instruction: {prompt}

Apply the instruction and return the WHOLE revised dashboard in the same JSON shape. Keep every
widget's "id" unchanged unless you remove it; give new widgets new ids. Change only what the
instruction asks for. At most {max_widgets} widgets and {max_filters} filters.

{sql_rules}

Colors: use these in order: {colors}.

Return JSON exactly in this shape:
{shape}"""

FIX_PROMPT = """\
These dashboard widgets' SQL failed. Fix each query so it runs and still shows what the title says.

Schema:
{schema}

Failures:
{failures}

{sql_rules}

Return JSON: {{"widgets": [{{"id": "<id>", "sql": "<fixed query>"}}]}}"""


# ── Spec handling ────────────────────────────────────────────────────────────

def _slug_id(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def _clean_filters(raw, ds: dataset_sql.MultiDataset) -> list[FilterDef]:
    out: list[FilterDef] = []
    seen: set[str] = set()
    for f in raw if isinstance(raw, list) else []:
        if not isinstance(f, dict):
            continue
        table, column = f.get("table"), f.get("column")
        dtype = dataset_sql.column_type(ds, table, column) if table and column else None
        if dtype is None:
            continue
        kind = "date_range" if f.get("type") == "date_range" else "category"
        if kind == "date_range" and dtype not in ("DATE", "TIMESTAMP"):
            continue
        fid = str(f.get("id") or _slug_id("f"))
        if fid in seen:
            fid = _slug_id("f")
        seen.add(fid)
        options = dataset_sql.filter_options(ds, {"table": table, "column": column}) if kind == "category" else None
        if kind == "category" and not options:
            continue   # too many values to offer as a picker
        out.append(FilterDef(id=fid, label=str(f.get("label") or column), table=table,
                             column=column, type=kind, options=options))
        if len(out) >= MAX_FILTERS:
            break
    return out


def _widget_from_raw(w: dict, idx: int, filter_ids: set[str]) -> Widget | None:
    kind = w.get("kind") if w.get("kind") in KINDS else ("chart" if w.get("chart") else "table")
    spec: dict = {"size": w.get("size") if w.get("size") in SIZES else None}
    if kind == "kpi":
        spec["kpi"] = w.get("kpi") if isinstance(w.get("kpi"), dict) else {}
    elif kind == "chart":
        chart = w.get("chart") if isinstance(w.get("chart"), dict) else {}
        if chart.get("type") not in CHART_TYPES:
            chart["type"] = "bar"
        spec["chart"] = chart
    elif kind == "text":
        spec["text"] = str(w.get("text") or "")
    # Keep whatever manual settings came in on an existing widget's spec.
    if isinstance(w.get("spec"), dict):
        spec = {**w["spec"], **{k: v for k, v in spec.items() if v not in (None, {}, "")}}
    sql = w.get("sql") if kind != "text" else None
    if kind != "text" and not sql:
        return None
    return Widget(
        id=str(w.get("id") or _slug_id("w")),
        kind=kind,
        title=str(w.get("title") or f"Widget {idx + 1}")[:120],
        sql=sql,
        spec=spec,
        layout=w.get("layout") if isinstance(w.get("layout"), dict) else None,
        filterIds=[f for f in (w.get("filterIds") or []) if f in filter_ids],
    )


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def fit_spec(widget: Widget, result: WidgetResult) -> None:
    """Make the display keys point at columns the query really returned — the model sometimes
    names a key it then aliased differently."""
    cols = result.columns
    if not cols:
        return
    first = result.rows[0] if result.rows else {}
    numeric = [c for c in cols if _is_number(first.get(c))]
    if widget.kind == "kpi":
        kpi = widget.spec.setdefault("kpi", {})
        if kpi.get("valueKey") not in cols:
            kpi["valueKey"] = numeric[0] if numeric else cols[0]
    elif widget.kind == "chart":
        chart = widget.spec.setdefault("chart", {"type": "bar"})
        if chart.get("xKey") not in cols:
            chart["xKey"] = next((c for c in cols if c not in numeric), cols[0])
        ykeys = [y for y in (chart.get("yKeys") or []) if isinstance(y, dict) and y.get("key") in cols]
        if not ykeys:
            ykeys = [{"key": c, "label": c.replace("_", " ").title()}
                     for c in numeric if c != chart["xKey"]][:4]
        for i, y in enumerate(ykeys):
            y.setdefault("label", y["key"].replace("_", " ").title())
            y.setdefault("color", CHART_COLORS[i % len(CHART_COLORS)])
        chart["yKeys"] = ykeys


def auto_layout(widgets: list[Widget]) -> None:
    """Place widgets that have no position yet: row-packed on a 12-column grid, below anything
    already placed. KPIs first so they sit along the top of a new dashboard."""
    placed = [w for w in widgets if w.layout and {"x", "y", "w", "h"} <= set(w.layout)]
    bottom = max((w.layout["y"] + w.layout["h"] for w in placed), default=0)
    pending = [w for w in widgets if w not in placed]
    pending.sort(key=lambda w: 0 if w.kind == "kpi" else 1)
    x, y, row_h = 0, bottom, 0
    for w in pending:
        size = w.spec.get("size")
        if size not in SIZES:
            size = "s" if w.kind == "kpi" else ("xl" if w.kind == "table" else "m")
        width, height = SIZES[size]
        if x + width > GRID_COLS:
            x, y, row_h = 0, y + row_h, 0
        w.layout = {"x": x, "y": y, "w": width, "h": height}
        x += width
        row_h = max(row_h, height)


async def _run_widget(ds, widget: Widget, key: str = "all") -> WidgetResult:
    if widget.kind == "text" or not widget.sql:
        return WidgetResult(widget_id=widget.id, state_key=key)
    try:
        res = await dataset_sql.run(ds, widget.sql)
        return WidgetResult(widget_id=widget.id, state_key=key, columns=res.columns,
                            rows=dataset_sql.result_records(res), truncated=res.truncated)
    except Exception as err:
        return WidgetResult(widget_id=widget.id, state_key=key, error=f"{type(err).__name__}: {err}")


async def _validate(ds, widgets: list[Widget], system: str,
                    keep: dict[str, Widget] | None = None) -> tuple[list[Widget], list[WidgetResult], list[dict], int]:
    """Run every widget; give the failures one corrective round; then drop what still fails —
    or, for a widget that existed before the edit, put back its last working version."""
    keep = keep or {}
    results = {w.id: await _run_widget(ds, w) for w in widgets}
    failed = [w for w in widgets if results[w.id].error]
    tokens = 0
    if failed:
        failures = "\n\n".join(f'id {w.id} — "{w.title}"\nSQL: {w.sql}\nError: {results[w.id].error}'
                               for w in failed)
        try:
            fixed = await _llm.complete_json(
                provider=_agent.default_provider, model=_agent.default_model, system=system,
                messages=[{"role": "user", "content": FIX_PROMPT.format(
                    schema=ds.schema_text, failures=failures, sql_rules=SQL_RULES)}])
            tokens += _llm.count_tokens(str(fixed))
            for item in (fixed.get("widgets") if isinstance(fixed, dict) else None) or []:
                w = next((w for w in failed if w.id == item.get("id")), None)
                if w and item.get("sql"):
                    w.sql = item["sql"]
                    results[w.id] = await _run_widget(ds, w)
        except Exception as err:
            logger.warning("dashboard fix round failed | %s", err)
    out, dropped = [], []
    for w in widgets:
        if not results[w.id].error:
            fit_spec(w, results[w.id])
            out.append(w)
        elif w.id in keep:
            prev = keep[w.id]
            results[w.id] = await _run_widget(ds, prev)
            out.append(prev)
            dropped.append({"title": w.title, "error": "change reverted — its new query failed"})
        else:
            dropped.append({"title": w.title, "error": results[w.id].error})
    return out, [results[w.id] for w in out], dropped, tokens


def _fallback_spec(ds) -> dict:
    """A plain but correct dashboard, used in mock mode and when the model returns nothing usable."""
    widgets = []
    for i, name in enumerate(list(ds.tables)[:3]):
        widgets.append({"id": f"w{i}c", "kind": "kpi", "title": f"{name} — rows", "size": "s",
                        "sql": f'SELECT count(*) AS rows FROM "{name}"', "kpi": {"valueKey": "rows"}})
        widgets.append({"id": f"w{i}t", "kind": "table", "title": name,
                        "sql": f'SELECT * FROM "{name}" LIMIT 50'})
    return {"title": "Dashboard", "description": "", "filters": [], "widgets": widgets}


async def _spec_from_model(ds, prompt_text: str, system: str) -> tuple[dict, int]:
    if settings.MOCK_MODE:
        return _fallback_spec(ds), 0
    try:
        raw = await _llm.complete_json(
            provider=_agent.default_provider, model=_agent.default_model, system=system,
            messages=[{"role": "user", "content": prompt_text}])
        if isinstance(raw, dict) and raw.get("widgets"):
            return raw, _llm.count_tokens(str(raw))
    except Exception as err:
        logger.warning("dashboard spec generation failed | %s", err)
    return _fallback_spec(ds), 0


def _assemble(raw: dict, ds) -> tuple[DashboardSpec, list[Widget]]:
    filters = _clean_filters(raw.get("filters"), ds)
    fids = {f.id for f in filters}
    widgets: list[Widget] = []
    seen: set[str] = set()
    for i, w in enumerate((raw.get("widgets") or [])[:MAX_WIDGETS]):
        if not isinstance(w, dict):
            continue
        widget = _widget_from_raw(w, i, fids)
        if widget is None:
            continue
        if widget.id in seen:
            widget.id = _slug_id("w")
        seen.add(widget.id)
        widgets.append(widget)
    spec = DashboardSpec(title=str(raw.get("title") or "Dashboard")[:120],
                         description=str(raw.get("description") or "")[:300], filters=filters)
    return spec, widgets


def _prompt_view(spec: DashboardSpec) -> str:
    """The dashboard as the model edits it: no stored layout noise, sizes instead."""
    import json

    widgets = []
    for w in spec.widgets:
        item = {"id": w.id, "kind": w.kind, "title": w.title, "filterIds": w.filterIds}
        if w.sql:
            item["sql"] = w.sql
        for k in ("kpi", "chart", "text", "size"):
            if w.spec.get(k) is not None:
                item[k] = w.spec[k]
        widgets.append(item)
    return json.dumps({"title": spec.title, "description": spec.description,
                       "filters": [f.model_dump(exclude={"options"}) for f in spec.filters],
                       "widgets": widgets}, ensure_ascii=False, indent=1)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=DashboardResponse, summary="Build a dashboard from a prompt")
async def generate(request: GenerateRequest) -> DashboardResponse:
    ds = await dataset_sql.load_sources([s.model_dump() for s in request.sources])
    try:
        system = await _agent.build_system_prompt(request.user_id, request.organization_id,
                                                  use_brand_kit=False)
        raw, tokens = await _spec_from_model(ds, GENERATE_PROMPT.format(
            schema=ds.schema_text, prompt=request.prompt, max_widgets=MAX_WIDGETS,
            max_filters=MAX_FILTERS, sql_rules=SQL_RULES, colors=CHART_COLORS[:6],
            shape=SPEC_SHAPE.format()), system)
        spec, widgets = _assemble(raw, ds)
        widgets, results, dropped, fix_tokens = await _validate(ds, widgets, system)
        if not widgets:   # nothing the model wrote ran — still hand back something true
            spec, widgets = _assemble(_fallback_spec(ds), ds)
            widgets, results, _, _ = await _validate(ds, widgets, system)
        auto_layout(widgets)
        spec.widgets = widgets
        return DashboardResponse(dashboard=spec, results=results, dropped=dropped,
                                 rows_used=ds.total_rows, whole_file=ds.whole_file,
                                 tokens_used=tokens + fix_tokens, model_used=_agent.default_model)
    finally:
        ds.con.close()


@router.post("/edit", response_model=DashboardResponse, summary="Change a dashboard by prompt")
async def edit(request: EditRequest) -> DashboardResponse:
    ds = await dataset_sql.load_sources([s.model_dump() for s in request.sources])
    try:
        system = await _agent.build_system_prompt(request.user_id, request.organization_id,
                                                  use_brand_kit=False)
        current = request.dashboard
        before = {w.id: w for w in current.widgets}
        focus = ""
        if request.widget_id and request.widget_id in before:
            focus = f'\nThe instruction is about the widget with id "{request.widget_id}" ' \
                    f'("{before[request.widget_id].title}").\n'
        if settings.MOCK_MODE:
            raw, tokens = {"title": current.title, "description": current.description,
                           "filters": [f.model_dump() for f in current.filters],
                           "widgets": [w.model_dump() for w in current.widgets]}, 0
        else:
            raw, tokens = await _spec_from_model(ds, EDIT_PROMPT.format(
                schema=ds.schema_text, current=_prompt_view(current), focus=focus,
                prompt=request.prompt, max_widgets=MAX_WIDGETS, max_filters=MAX_FILTERS,
                sql_rules=SQL_RULES, colors=CHART_COLORS[:6], shape=SPEC_SHAPE.format()), system)
        spec, widgets = _assemble(raw, ds)
        # Existing widgets keep their place and manual settings unless the model changed them.
        for w in widgets:
            prev = before.get(w.id)
            if prev is None:
                continue
            new_size = w.spec.get("size")
            w.spec = {**prev.spec, **{k: v for k, v in w.spec.items() if v not in (None, {}, "")}}
            if prev.layout and (not new_size or new_size == prev.spec.get("size")):
                w.layout = prev.layout
            else:
                w.layout = None
        widgets, results, dropped, fix_tokens = await _validate(ds, widgets, system, keep=before)
        auto_layout(widgets)
        spec.widgets = widgets
        return DashboardResponse(dashboard=spec, results=results, dropped=dropped,
                                 rows_used=ds.total_rows, whole_file=ds.whole_file,
                                 tokens_used=tokens + fix_tokens, model_used=_agent.default_model)
    finally:
        ds.con.close()


@router.post("/run", response_model=RunResponse, summary="Compute every widget for each filter state")
async def run(request: RunRequest) -> RunResponse:
    """One DuckDB for the whole refresh. Each widget sees only the filters it is subscribed to,
    so widgets are grouped by the filter values that actually reach them."""
    ds = await dataset_sql.load_sources([s.model_dump() for s in request.sources])
    try:
        filters = [f.model_dump() for f in request.filters]
        options = {f["id"]: (dataset_sql.filter_options(ds, f) if f["type"] == "category" else None)
                   for f in filters}
        results: list[WidgetResult] = []
        for state in request.states:
            groups: dict[tuple, list[Widget]] = {}
            for w in request.widgets:
                effective = {k: v for k, v in state.values.items() if k in w.filterIds}
                groups.setdefault(tuple(sorted((k, repr(v)) for k, v in effective.items())), []).append(w)
            for widgets in groups.values():
                effective = {k: v for k, v in state.values.items() if k in widgets[0].filterIds}
                dataset_sql.apply_filters(ds, filters, effective)
                for w in widgets:
                    results.append(await _run_widget(ds, w, state.key))
        return RunResponse(results=results, filter_options=options,
                           rows_used=ds.total_rows, whole_file=ds.whole_file)
    finally:
        ds.con.close()


@router.post("/check-sql", summary="Validate one widget query")
async def check_sql(request: RunRequest) -> RunResponse:
    """Used by the settings panel's SQL editor: run just the given widgets, unfiltered."""
    request.states = [RunState()]
    return await run(request)

