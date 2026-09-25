"""Regenerates kulhad_orders.csv — a chai brand's order export, the way a customer uploads it.

Deterministic (seeded), so the answers the cases compute from it never move. It is shaped to
catch one specific failure: the first 25 rows are mostly Delhi, but over the whole file Mumbai
sells the most by a wide margin. An answer read off a sample of the top rows gets it wrong.

    python evals/fixtures/make_orders.py
"""
import csv
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).with_name("kulhad_orders.csv")
PRODUCTS = {"Masala Chai 250g": 349, "Elaichi Chai 250g": 399, "Kulhad Gift Box": 1299}
CHANNELS = ["Website", "Amazon", "Instagram"]


def inr(n: int) -> str:
    """Indian digit grouping, the way Shopify/Excel exports in India show it: ₹1,23,450."""
    s = str(n)
    if len(s) <= 3:
        return f"₹{s}"
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return "₹" + ",".join(groups + [tail])


def main() -> None:
    write(OUT, rows=320, delhi_head=25, seed=20260925)
    # Bigger than the server's 500-row preview, and shaped so the preview alone points to the
    # wrong city: only reading the whole upload gets these right.
    big = write(OUT.with_name("kulhad_orders_5k.csv"), rows=5000, delhi_head=500, seed=5000)
    write_xlsx(big, OUT.with_name("kulhad_orders_5k.xlsx"))


def write_xlsx(rows: list[dict], path: Path) -> None:
    """The same orders as an Excel export: a title block above the header (the server's header
    detection skips it) and a second, small sheet."""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Orders"
    ws.append(["Kulhad Co. — Order export"])
    ws.append([])
    ws.append(list(rows[0]))
    for r in rows:
        ws.append(list(r.values()))
    targets = wb.create_sheet("Targets")
    targets.append(["City", "Monthly Target"])
    for city, target in [("Mumbai", "₹4,00,000"), ("Delhi", "₹2,50,000"), ("Bengaluru", "₹1,50,000"), ("Pune", "₹75,000")]:
        targets.append([city, target])
    wb.save(path)
    print(f"wrote {len(rows)} rows -> {path}")


def write(out: Path, rows: int, delhi_head: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    records = []
    start = date(2026, 1, 1)
    for i in range(rows):
        # Top of the file is Delhi-heavy; the whole file is Mumbai-heavy.
        if i < delhi_head:
            city = rng.choices(["Delhi", "Mumbai", "Pune"], weights=[8, 1, 1])[0]
        else:
            city = rng.choices(["Mumbai", "Delhi", "Bengaluru", "Pune"], weights=[6, 2, 2, 1])[0]
        product = rng.choice(list(PRODUCTS))
        qty = rng.choices([1, 2, 3, 4], weights=[6, 3, 1, 1])[0]
        amount = PRODUCTS[product] * qty
        day = start + timedelta(days=rng.randrange(0, 120))  # Jan–Apr 2026
        status = "Returned" if rng.random() < 0.07 else "Delivered"
        # Real exports are inconsistent: some amounts carry ₹ and grouping, some are bare.
        amount_str = inr(amount) if rng.random() < 0.7 else str(amount)
        records.append({
            "Order ID": f"KC-{10400 + i}",
            "Order Date": day.isoformat(),
            "City": city,
            "Product": product,
            "Qty": qty,
            "Amount": amount_str,
            "Channel": rng.choice(CHANNELS),
            "Status": status,
        })
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(records[0]))
        w.writeheader()
        w.writerows(records)
    print(f"wrote {len(records)} rows -> {out}")
    return records


if __name__ == "__main__":
    main()
