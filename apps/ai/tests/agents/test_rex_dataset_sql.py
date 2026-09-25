"""Rex query-dataset over every row with DuckDB: loading messy uploads, and the SQL guard."""
import asyncio

import pandas as pd
import pytest

from agents.rex import dataset_sql as d

ORDERS = {
    "headers": ["Order Date", "City", "Amount", "Status"],
    "columnTypes": {"Order Date": "date", "City": "categorical", "Amount": "numeric", "Status": "categorical"},
    "rows": [
        {"Order Date": "2026-01-11", "City": "Delhi", "Amount": "₹1,299", "Status": "Delivered"},
        {"Order Date": "2026-03-05", "City": "Mumbai", "Amount": "₹1,23,450", "Status": "Delivered"},
        {"Order Date": "05/03/2026", "City": "Mumbai", "Amount": "349", "Status": "Returned"},
        {"Order Date": "", "City": "Pune", "Amount": "N/A", "Status": "Delivered"},
    ],
}


def _run(ds, sql):
    return asyncio.run(d.run(ds, sql))


@pytest.mark.parametrize("raw,expected", [
    ("₹1,23,450", 123450), ("$1,200.50", 1200.5), ("12%", 12), ("(300)", -300),
    ("1299", 1299), ("Rs. 499", 499), ("", None), ("N/A", None), ("abc", None),
])
def test_parse_number(raw, expected):
    assert d.parse_number(raw) == expected


def test_parse_dates_iso_is_never_flipped_and_slashes_are_day_first():
    got = d.parse_dates(pd.Series(["2026-01-11", "11/01/2026", "Jan-25", "garbage"]))
    assert [str(x)[:10] for x in got] == ["2026-01-11", "2026-01-11", "2025-01-01", "NaT"]


def test_load_cleans_amounts_and_dates_so_sql_sums_every_row():
    ds = d.load(ORDERS)
    res = _run(ds, 'SELECT "City", sum("Amount") FROM data WHERE "Status" = \'Delivered\' '
                   'GROUP BY 1 ORDER BY 2 DESC')
    assert res.rows[0] == ["Mumbai", 123450.0]
    res = _run(ds, 'SELECT count(*) FROM data WHERE strftime("Order Date", \'%Y-%m\') = \'2026-03\'')
    assert res.rows == [[2]]  # the ISO and the day-first 5 March both land in March
    assert "values ['Delivered', 'Returned']" in ds.schema_text


def test_multi_sheet_workbooks_become_one_table_per_sheet():
    ds = d.load({**ORDERS, "sheets": {"Orders 2026": ORDERS, "Budget": {
        "headers": ["Month", "Target"], "columnTypes": {"Month": "text", "Target": "numeric"},
        "rows": [{"Month": "Jan", "Target": "5,000"}]}}})
    assert set(ds.tables) == {"orders_2026", "budget"}
    assert _run(ds, 'SELECT sum("Target") FROM budget').rows == [[5000.0]]


@pytest.mark.parametrize("sql", [
    "DROP TABLE data",
    "SELECT 1; DROP TABLE data",
    "SELECT * FROM read_csv('secrets.csv')",
    "COPY data TO 'out.csv'",
    "SELECT * FROM query('SELECT 1')",
    "ATTACH 'other.db'",
    "SELECT getenv('OPENAI_API_KEY')",
    "INSTALL httpfs",
    "PRAGMA database_list",
])
def test_guard_rejects_anything_but_one_read_only_select(sql):
    with pytest.raises(d.UnsafeSQL):
        d.check_sql(sql)


def test_guard_ignores_keywords_inside_names_and_strings():
    assert d.check_sql('SELECT "Set", \'drop table\' AS note FROM data;') == 'SELECT "Set", \'drop table\' AS note FROM data'


def test_files_are_unreachable_even_without_a_table_function():
    ds = d.load(ORDERS)
    with pytest.raises(Exception):
        _run(ds, "SELECT * FROM 'C:/Windows/win.ini'")
