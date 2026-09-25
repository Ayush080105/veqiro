"""Rex: founders asking about their own numbers. Being wrong here costs real decisions."""
from collections import defaultdict

from evals.case import DATASETS, Case, chat, read_rows, table
from evals.graders import (CORRECT, HONEST, answers_first, avoids, count, judge, mentions,
                           nonempty, number)
from evals.personas import KULHAD, LEDGERLOOP

SAAS_TYPES = {"Month": "date", "MRR": "numeric", "Marketing_Spend": "numeric", "Burn": "numeric",
              "Cash": "numeric", "New_Customers": "numeric", "Churn_Rate": "numeric"}
ORDER_TYPES = {"Order ID": "text", "Order Date": "date", "City": "categorical",
               "Product": "categorical", "Qty": "numeric", "Amount": "numeric",
               "Channel": "categorical", "Status": "categorical"}

# Ground truth, computed here from the same files the agent sees.
_saas = read_rows("saas_metrics.csv")
_last = _saas[-1]
RUNWAY = float(_last["Cash"]) / float(_last["Burn"])
MRR_ADDED = float(_saas[-1]["MRR"]) - float(_saas[0]["MRR"])

_orders = read_rows("kulhad_orders.csv")
_amt = lambda r: int(r["Amount"].replace("₹", "").replace(",", ""))
_delivered = [r for r in _orders if r["Status"] == "Delivered"]
_by_city, _by_month = defaultdict(int), defaultdict(int)
for r in _delivered:
    _by_city[r["City"]] += _amt(r)
    _by_month[r["Order Date"][:7]] += _amt(r)
TOP_CITY = max(_by_city, key=_by_city.get)
RETURNED = sum(r["Status"] == "Returned" for r in _orders)
MARCH = _by_month["2026-03"]
BEST_MONTH = max(_by_month, key=_by_month.get)
_MONTH_NAMES = {"2026-01": "January", "2026-02": "February", "2026-03": "March", "2026-04": "April"}



def _query(case_id, question, csv, types, name, graders, story, tier="regression", known=None, org=LEDGERLOOP):
    return Case(
        id=case_id, agent="rex", endpoint="/ai/rex/query-dataset",
        payload={"user_id": "eval_user", "organization_id": org, "dataset_name": name,
                 "query": question, "table": table(csv, types)},
        graders=[nonempty("answer"), *graders], story=story, tier=tier, known_issue=known,
        latency_s=30,
    )


_big = read_rows("kulhad_orders_5k.csv")
_big_by_city = defaultdict(int)
for r in _big:
    if r["Status"] == "Delivered":
        _big_by_city[r["City"]] += _amt(r)
BIG_TOP_CITY = max(_big_by_city, key=_big_by_city.get)
BIG_RETURNED = sum(r["Status"] == "Returned" for r in _big)
PREVIEW = 500  # the server stores this many rows and sends a link to the whole file


def _preview(csv_name: str) -> dict:
    t = table(csv_name, ORDER_TYPES)
    return {**t, "rows": t["rows"][:PREVIEW]}


def _upload(case_id, question, file_name, graders, story, preview=None):
    """A query on an upload bigger than the stored preview, sent the way production sends it."""
    return Case(
        id=case_id, agent="rex", endpoint="/ai/rex/query-dataset",
        payload={"user_id": "eval_user", "organization_id": KULHAD,
                 "dataset_name": "Kulhad orders 2026 (5,000 rows)", "query": question,
                 "table": preview or _preview("kulhad_orders_5k.csv"),
                 "file_url": f"fixture://{file_name}",
                 "file_name": f"rex-dataset/{KULHAD}-{file_name}"},
        graders=[nonempty("answer"), *graders], story=story, latency_s=45,
    )


_XLSX_PREVIEW = {
    **_preview("kulhad_orders_5k.csv"),
    "sheets": {
        "Orders": _preview("kulhad_orders_5k.csv"),
        "Targets": {"headers": ["City", "Monthly Target"],
                    "columnTypes": {"City": "categorical", "Monthly Target": "numeric"},
                    "rows": [{"City": "Mumbai", "Monthly Target": "₹4,00,000"},
                             {"City": "Delhi", "Monthly Target": "₹2,50,000"},
                             {"City": "Bengaluru", "Monthly Target": "₹1,50,000"},
                             {"City": "Pune", "Monthly Target": "₹75,000"}]},
    },
}

UPLOAD_CASES = [
    _upload("rex.upload5k.top_city",
            "Which city brings us the most revenue from delivered orders?", "kulhad_orders_5k.csv",
            [answers_first("answer", BIG_TOP_CITY, "Mumbai", "Delhi", "Bengaluru", "Pune"),
             number("rows_used", 5000, tol_pct=0, name="read all 5,000 rows")],
            "Owner uploads a 5,000-row export. The server keeps a 500-row preview in which Delhi "
            "leads; across the whole file Mumbai leads by 2x."),

    _upload("rex.upload5k.returns_count", "How many orders were returned?", "kulhad_orders_5k.csv",
            [number("answer", BIG_RETURNED, tol_pct=0, name=f"{BIG_RETURNED} returns (preview has 50)")],
            "A count over the whole file, not the preview."),

    _upload("rex.upload5k.xlsx_two_sheets",
            "Which city has the most delivered revenue overall, and what is that city's monthly target?",
            "kulhad_orders_5k.xlsx",
            [answers_first("answer", BIG_TOP_CITY, "Mumbai", "Delhi", "Bengaluru", "Pune"),
             mentions("answer", "4,00,000", "400,000", "400000", "4 lakh", "4.0 lakh", "₹4L",
                      name="reads the Targets sheet (₹4,00,000)"),
             number("rows_used", 5004, tol_pct=0, name="read both sheets in full")],
            "Excel export with a title block above the header and a second 'Targets' sheet.",
            preview=_XLSX_PREVIEW),

    _upload("rex.upload5k.file_unreachable_is_honest",
            "Which city brings us the most revenue from delivered orders?", "missing.csv",
            [judge("Tells the customer the answer only covers the first 500 rows (or part of the file).",
                   category=HONEST, path="answer")],
            "The file link fails (expired, R2 down). Rex must still answer from the preview, "
            "and say it only covered part of the file."),
]

DATASETS["ds_orders_5k"] = {
    "name": "Kulhad orders 2026", "table": _XLSX_PREVIEW,
    "file_url": "fixture://kulhad_orders_5k.xlsx",
    "file_name": f"rex-dataset/{KULHAD}-kulhad_orders_5k.xlsx",
}
# What the server now sends Rex's chat: every uploaded file, sheet and column.
_UPLOADED = {"rex_datasets": [{"id": "ds_orders_5k", "name": "Kulhad orders 2026", "sheets": {
    "Orders": [{"name": h, "type": t} for h, t in ORDER_TYPES.items()],
    "Targets": [{"name": "City", "type": "categorical"}, {"name": "Monthly Target", "type": "numeric"}],
}}]}


def _chat_on_upload(case_id, message, graders, story):
    endpoint, payload = chat("rex", message, KULHAD)
    payload["metadata"] = {**payload["metadata"], **_UPLOADED}
    return Case(id=case_id, agent="rex", endpoint=endpoint, payload=payload,
                graders=[nonempty("response"),
                         mentions("tool_trace", "Query Uploaded Data", "query_uploaded_data", category=CORRECT,
                                  name="computed it from the file"), *graders],
                story=story, latency_s=60)


CHAT_ON_UPLOAD_CASES = [
    _chat_on_upload("rex.chat_upload.top_city",
                    "which city is making us the most money from delivered orders?",
                    [answers_first("response", BIG_TOP_CITY, "Mumbai", "Delhi", "Bengaluru", "Pune")],
                    "Owner types the question into Rex's chat instead of pressing Ask. Rex must use "
                    "the uploaded 5,000-row file, not ask for numbers."),
    _chat_on_upload("rex.chat_upload.sheet_without_dates",
                    "Delhi ka monthly target kitna hai?",
                    [mentions("response", "2,50,000", "250,000", "250000", "2.5 lakh", "2.50 lakh",
                              name="₹2,50,000 from the Targets sheet")],
                    "The answer is on a sheet with no date column at all (City, Monthly Target)."),
    _chat_on_upload("rex.chat_upload.no_bounce",
                    "how many orders got returned?",
                    [number("response", BIG_RETURNED, tol_pct=0, name=f"{BIG_RETURNED} returns"),
                     judge("Does not ask the customer to paste, share or upload data they already uploaded.",
                           path="response")],
                    "A vague question with the file already uploaded: bouncing it back is friction."),
]

CASES = UPLOAD_CASES + CHAT_ON_UPLOAD_CASES + [
    _query("rex.dataset.churn_spike",
           "Which month did churn spike and what else changed that month?",
           "saas_metrics.csv", SAAS_TYPES, "LedgerLoop metrics 2025-26",
           [mentions("answer", "July 2025", "2025-07", "Jul 2025", "July"),
            mentions("answer", "marketing", category=CORRECT, name="links it to the marketing cut"),
            judge("Does not claim as fact that one specific change caused the churn spike "
                  "(describing what changed alongside it is fine).",
                  category=HONEST, path="answer")],
           "SaaS founder uploaded 15 months of metrics and wants to understand a bad month."),

    _query("rex.dataset.runway_from_upload",
           "Based on the latest month, how many months of runway do we have?",
           "saas_metrics.csv", SAAS_TYPES, "LedgerLoop metrics 2025-26",
           [number("answer", RUNWAY, tol_pct=3, name=f"runway ≈ {RUNWAY:.1f} months")],
           "Founder checks runway before a board call; the number has to be right."),

    _query("rex.dataset.mrr_added",
           "How much MRR did we add from the first month to the latest month?",
           "saas_metrics.csv", SAAS_TYPES, "LedgerLoop metrics 2025-26",
           [number("answer", MRR_ADDED, tol_pct=0.5, name=f"MRR added = {MRR_ADDED:,.0f}")],
           "Founder writing an investor update needs one exact figure."),

    _query("rex.orders.top_city",
           "Which city brings us the most revenue from delivered orders?",
           "kulhad_orders.csv", ORDER_TYPES, "Kulhad orders Jan-Apr 2026",
           [answers_first("answer", TOP_CITY, "Mumbai", "Delhi", "Bengaluru", "Pune")],
           "Chai brand owner deciding where to run ads uploads a 320-row Shopify export. The "
           "first rows are mostly Delhi; across the file it is clearly Mumbai. (Was answered "
           "from a 25-row sample until query-dataset moved to SQL over every row.)", org=KULHAD),

    _query("rex.orders.returns_count",
           "How many orders were returned?",
           "kulhad_orders.csv", ORDER_TYPES, "Kulhad orders Jan-Apr 2026",
           [number("answer", RETURNED, tol_pct=0, name=f"{RETURNED} returns")],
           "Owner checking whether returns are a problem.", org=KULHAD),

    _query("rex.orders.march_revenue_hinglish",
           "March mein delivered orders se total kitna revenue aaya?",
           "kulhad_orders.csv", ORDER_TYPES, "Kulhad orders Jan-Apr 2026",
           [number("answer", MARCH, tol_pct=0.5, name=f"March revenue ₹{MARCH:,}"),
            judge("The answer is understandable to someone who asked in Hinglish (English, "
                  "Hindi or Hinglish are all fine).", path="answer")],
           "Owner asks in Hinglish, the way they talk. Amounts in the file are messy: some "
           "'₹1,299', some bare '1299'.", org=KULHAD),

    _query("rex.orders.best_month",
           "Which was our best month for delivered revenue?",
           "kulhad_orders.csv", ORDER_TYPES, "Kulhad orders Jan-Apr 2026",
           [answers_first("answer", _MONTH_NAMES[BEST_MONTH], *_MONTH_NAMES.values())],
           "Owner planning inventory for the next season.", org=KULHAD),

    _query("rex.orders.chart_request",
           "Show me a chart of revenue by channel",
           "kulhad_orders.csv", ORDER_TYPES, "Kulhad orders Jan-Apr 2026",
           [nonempty("chart.data", "chart.xKey"), count("chart.yKeys", 1)],
           "Owner asks for a chart; an answer with no chart is a dead end.", org=KULHAD),

    Case(id="rex.runway.endpoint", agent="rex", endpoint="/ai/rex/runway",
         payload={"user_id": "eval_user", "organization_id": LEDGERLOOP, "cash_on_hand": 9000000,
                  "monthly_burn": 750000, "monthly_revenue": 250000, "growth_rate_pct": 0},
         graders=[number("months_remaining", 18, tol_pct=3, name="18 months at ₹5L net burn"),
                  nonempty("verdict", "recommendation")],
         story="Founder fills the runway form: ₹90L cash, ₹7.5L burn, ₹2.5L revenue.",
         latency_s=30),

    Case(id="rex.chat.runway_casual", agent="rex",
         endpoint=chat("rex", "hey we have 60 lakh in the bank and we're burning around 5 lakh a month, how long do we survive?", LEDGERLOOP)[0],
         payload=chat("rex", "hey we have 60 lakh in the bank and we're burning around 5 lakh a month, how long do we survive?", LEDGERLOOP)[1],
         graders=[number("response", 12, tol_pct=0, name="says 12 months"),
                  avoids("response", r"\bwhat is your (monthly )?(burn|revenue)\b", category=CORRECT,
                         name="doesn't ask for numbers it was given"),
                  judge("Leads with the answer (about 12 months) rather than burying it.",
                        "Does not ask the customer to upload data or connect a tool before answering.",
                        path="response")],
         story="Founder types a quick question in chat with both numbers in it.", latency_s=30),
]
