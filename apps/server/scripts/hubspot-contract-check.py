"""Loads a snapshot written by hubspot-contract-check.ts with the AI service's real loader and
runs the queries a dashboard would. Run from the repo root:

    python -I apps/server/scripts/hubspot-contract-check.py <output path prefix>
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "ai"))
from agents.rex import dataset_sql  # noqa: E402

prefix = sys.argv[1]
table = json.loads(pathlib.Path(f"{prefix}.table.json").read_text(encoding="utf-8"))
data = pathlib.Path(f"{prefix}.csv").read_bytes()

ds = dataset_sql.load_file(data, "snapshot.csv", table)
assert ds.whole_file, "should read the whole file, not the preview"
assert ds.total_rows == 1200, f"expected 1200 rows, got {ds.total_rows}"

types = dict(ds.con.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'data'").fetchall())
print(types)
assert types["amount"] == "DOUBLE", types["amount"]
assert types["close_date"] == "DATE", types["close_date"]
assert types["created_at"] == "DATE", types["created_at"]
assert types["is_won"] == "VARCHAR"

won = ds.con.execute("SELECT count(*), round(sum(amount), 2) FROM data WHERE is_won = 'true'").fetchone()
open_w = ds.con.execute("SELECT round(sum(weighted_amount), 2) FROM data WHERE is_open = 'true'").fetchone()[0]
monthly = ds.con.execute("SELECT strftime(date_trunc('month', created_at), '%Y-%m') m, count(*) FROM data GROUP BY 1 ORDER BY 1").fetchall()
quoted = ds.con.execute("SELECT count(*) FROM data WHERE deal_name LIKE '%quotes%'").fetchone()[0]
owner = ds.con.execute("SELECT count(DISTINCT owner_name) FROM data WHERE owner_name <> ''").fetchone()[0]
print("won", won, "open weighted", open_w, "months", len(monthly), "multi-line names", quoted, "owners", owner)
assert won[0] == 400 and quoted == 24 and len(monthly) == 12 and owner == 3  # two people and "Unassigned"
print("schema the model will see:\n" + ds.schema_text[:600].encode("ascii", "replace").decode())
print("OK: the AI service reads HubSpot snapshots as typed tables")
