from datetime import datetime, timedelta
from collections import defaultdict

from core.models import DataPoint


def compute_anomalies(data_points: list[DataPoint]) -> list[dict]:
    """Detect anomalies using z-score. |z| > 2 is flagged as anomaly."""
    if len(data_points) < 3:
        return []
    try:
        import numpy as np
        values = np.array([dp.value for dp in data_points])
        mean = np.mean(values)
        std = np.std(values)
        if std == 0:
            return []
        z_scores = (values - mean) / std
        anomalies = []
        for i, (dp, z) in enumerate(zip(data_points, z_scores)):
            if abs(z) > 2:
                anomalies.append({
                    "date": dp.date,
                    "value": dp.value,
                    "z_score": round(float(z), 2),
                    "direction": "spike" if z > 0 else "dip",
                    "severity": "high" if abs(z) > 3 else "medium",
                })
        return anomalies
    except ImportError:
        # Fallback without numpy
        values = [dp.value for dp in data_points]
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = variance ** 0.5
        if std == 0:
            return []
        anomalies = []
        for dp in data_points:
            z = (dp.value - mean) / std
            if abs(z) > 2:
                anomalies.append({
                    "date": dp.date,
                    "value": dp.value,
                    "z_score": round(z, 2),
                    "direction": "spike" if z > 0 else "dip",
                    "severity": "high" if abs(z) > 3 else "medium",
                })
        return anomalies


def correlate_anomalies(metrics_anomalies: dict[str, list[dict]]) -> list[dict]:
    """Cross-correlate anomalies across metrics. Returns enriched anomalies with root cause hints.

    metrics_anomalies: {metric_name: [anomaly_dict, ...]}
    Returns flat list of all anomalies, each enriched with correlated_with and root_cause_hypothesis.
    """
    # Bucket anomalies by month (YYYY-MM) so we can find same-period co-occurrences
    by_month: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for metric_name, anomalies in metrics_anomalies.items():
        for a in anomalies:
            month = a["date"][:7]  # YYYY-MM
            by_month[month].append((metric_name, a))

    # Build lookup: for each metric+date, which other metrics also had anomalies?
    enriched: list[dict] = []
    for metric_name, anomalies in metrics_anomalies.items():
        for a in anomalies:
            month = a["date"][:7]
            co_occurring = [
                other_metric
                for other_metric, _ in by_month[month]
                if other_metric != metric_name
            ]
            enriched_a = dict(a)
            if co_occurring:
                enriched_a["correlated_with"] = co_occurring
                # Generate a hypothesis based on known causal relationships
                hypothesis = _build_hypothesis(metric_name, a["direction"], co_occurring)
                if hypothesis:
                    enriched_a["root_cause_hypothesis"] = hypothesis
            enriched.append(enriched_a)

    return enriched


_CAUSE_EFFECT = [
    # (cause_metric, cause_direction, effect_metric, hypothesis)
    ("churn_rate", "spike", "mrr", "Churn spike likely caused MRR drop — investigate why customers left"),
    ("churn_rate", "spike", "revenue", "Churn spike likely drove revenue decline — run churn retrospective"),
    ("marketing_spend", "spike", "new_customers", "Marketing surge drove customer acquisition spike"),
    ("marketing_spend", "dip", "new_customers", "Marketing cut likely reduced new customer acquisition"),
    ("expenses", "spike", "burn", "Expense increase drove burn spike — review largest expense line"),
    ("burn", "spike", "cash", "Burn spike reduced cash position — audit largest expense"),
    ("mrr", "spike", "revenue", "MRR expansion drove revenue increase"),
    ("mrr", "dip", "revenue", "MRR contraction is driving revenue decline"),
    ("new_customers", "dip", "mrr", "Fewer new customers may be slowing MRR growth"),
]


def _build_hypothesis(metric: str, direction: str, co_occurring: list[str]) -> str | None:
    for cause_m, cause_dir, effect_m, hypothesis in _CAUSE_EFFECT:
        if metric == cause_m and direction == cause_dir and effect_m in co_occurring:
            return hypothesis
        if metric == effect_m and cause_m in co_occurring:
            return hypothesis
    return None


def compute_health_indicator(metrics: dict) -> str:
    """Compute overall business health: 'green' | 'amber' | 'red'.

    Metrics dict can contain: churn_rate, burn_rate, runway_months,
    growth_rate, nrr, cac_payback_months.
    """
    red_flags = 0
    amber_flags = 0

    churn = metrics.get("churn_rate", 0)
    if churn > 0.05:
        red_flags += 1
    elif churn > 0.03:
        amber_flags += 1

    runway = metrics.get("runway_months", 24)
    if runway < 3:
        red_flags += 2
    elif runway < 6:
        red_flags += 1
    elif runway < 12:
        amber_flags += 1

    growth = metrics.get("growth_rate", 0)
    if growth < -0.05:
        red_flags += 1
    elif growth < 0.05:
        amber_flags += 1

    nrr = metrics.get("nrr", 1.0)
    if nrr < 0.85:
        red_flags += 1
    elif nrr < 1.0:
        amber_flags += 1

    if red_flags >= 2:
        return "red"
    elif red_flags == 1 or amber_flags >= 2:
        return "amber"
    return "green"


def compute_derived_metrics(
    revenue_data: list[DataPoint],
    expenses_data: list[DataPoint],
    subscribers_data: list[DataPoint],
) -> dict:
    """Compute SaaS financial metrics from raw data."""
    if not revenue_data:
        return {}

    # Sort by date
    rev_sorted = sorted(revenue_data, key=lambda d: d.date)
    exp_sorted = sorted(expenses_data, key=lambda d: d.date) if expenses_data else []
    sub_sorted = sorted(subscribers_data, key=lambda d: d.date) if subscribers_data else []

    # MRR = latest revenue value
    mrr = rev_sorted[-1].value if rev_sorted else 0
    arr = mrr * 12

    # Growth rate: (latest - previous) / previous
    growth_rate = 0.0
    if len(rev_sorted) >= 2:
        prev = rev_sorted[-2].value
        curr = rev_sorted[-1].value
        growth_rate = (curr - prev) / prev if prev else 0

    # Burn rate = latest expenses
    burn_rate = exp_sorted[-1].value if exp_sorted else 0

    # Runway = MRR / burn_rate (if burn > MRR, we're losing money)
    net_burn = burn_rate - mrr
    runway_months = 0.0
    if net_burn > 0 and mrr > 0:
        # Assume some cash reserve (~6x MRR by default)
        cash_reserve = mrr * 6
        runway_months = round(cash_reserve / net_burn, 1)
    elif net_burn <= 0:
        runway_months = 999  # Profitable / infinite runway

    # Churn rate: (prev_subs - curr_subs) / prev_subs
    churn_rate = 0.0
    if len(sub_sorted) >= 2:
        prev_subs = sub_sorted[-2].value
        curr_subs = sub_sorted[-1].value
        if prev_subs > 0:
            churn_rate = max(0, (prev_subs - curr_subs) / prev_subs)

    return {
        "mrr": round(mrr, 2),
        "arr": round(arr, 2),
        "growth_rate": round(growth_rate, 4),
        "growth_rate_pct": round(growth_rate * 100, 2),
        "churn_rate": round(churn_rate, 4),
        "churn_rate_pct": round(churn_rate * 100, 2),
        "burn_rate": round(burn_rate, 2),
        "net_burn": round(net_burn, 2),
        "runway_months": runway_months if runway_months < 999 else None,
        "is_profitable": net_burn <= 0,
    }


def _months_to_zero(cash: float, burn: float, mrr: float, growth_rate: float, max_months: int = 120) -> tuple:
    """Returns (months: int | None, date_of_zero: str). None means profitable (no zero date)."""
    if burn == 0:
        return None, "profitable"
    if cash <= 0:
        return 0, datetime.utcnow().strftime("%Y-%m-%d")

    current_cash = cash
    current_mrr = mrr
    for m in range(1, max_months + 1):
        current_mrr = current_mrr * (1 + growth_rate)
        net = burn - current_mrr
        if net <= 0:
            return None, "profitable"
        current_cash -= net
        if current_cash <= 0:
            zero_date = (datetime.utcnow() + timedelta(days=m * 30)).strftime("%Y-%m-%d")
            return m, zero_date

    zero_date = (datetime.utcnow() + timedelta(days=max_months * 30)).strftime("%Y-%m-%d")
    return max_months, zero_date


def compute_runway_scenarios(
    cash: float,
    burn: float,
    mrr: float = 0.0,
    growth_rate: float = 0.0,
) -> dict:
    """Calculate cash runway with base, optimistic, and pessimistic scenarios."""
    net_burn = round(burn - mrr, 2)

    base_months, base_date = _months_to_zero(cash, burn, mrr, growth_rate)

    # Optimistic: boost growth by 0.10 absolute if growing, else cut burn 10%
    if growth_rate > 0:
        opt_months, opt_date = _months_to_zero(cash, burn, mrr, growth_rate + 0.10)
        opt_assumption = f"Revenue growth accelerates to {(growth_rate + 0.10) * 100:.0f}% MoM"
    else:
        opt_months, opt_date = _months_to_zero(cash, burn * 0.90, mrr, growth_rate)
        opt_assumption = "Burn reduced 10% through cost optimisation"

    # Pessimistic: +20% burn, growth_rate - 0.10 (floor 0)
    pess_growth = max(0.0, growth_rate - 0.10)
    pess_months, pess_date = _months_to_zero(cash, burn * 1.20, mrr, pess_growth)
    pess_assumption = f"Burn increases 20% and revenue growth drops to {pess_growth * 100:.0f}% MoM"

    # Verdict from base scenario
    bm = base_months if base_months is not None else 999
    if bm < 6:
        verdict = "red"
        recommendation = "Immediate action required: extend runway within 30 days by cutting burn or closing revenue."
    elif bm < 12:
        verdict = "amber"
        recommendation = "Plan fundraise or burn reduction within 90 days."
    else:
        verdict = "green"
        recommendation = "Healthy runway. Focus on growth milestones before your next raise."

    return {
        "months_remaining": base_months,
        "date_of_zero": base_date,
        "cash_on_hand": cash,
        "monthly_burn": burn,
        "monthly_revenue": mrr,
        "net_burn": net_burn,
        "scenarios": [
            {
                "name": "base",
                "months": base_months,
                "date_of_zero": base_date,
                "assumption": f"Current burn and {growth_rate * 100:.0f}% MoM revenue growth maintained",
            },
            {
                "name": "optimistic",
                "months": opt_months,
                "date_of_zero": opt_date,
                "assumption": opt_assumption,
            },
            {
                "name": "pessimistic",
                "months": pess_months,
                "date_of_zero": pess_date,
                "assumption": pess_assumption,
            },
        ],
        "verdict": verdict,
        "recommendation": recommendation,
    }


def compute_unit_economics(
    marketing_data: list[DataPoint],
    customers_data: list[DataPoint],
    arpu: float,
    lifetime_months: float = 24.0,
) -> dict:
    """Compute CAC, LTV, LTV:CAC ratio, and payback period from time-series data."""
    total_spend = sum(dp.value for dp in marketing_data)
    total_customers = sum(dp.value for dp in customers_data)

    if total_customers == 0:
        return {"error": "No customers in the provided data — cannot compute CAC"}

    cac = round(total_spend / total_customers, 2)
    ltv = round(arpu * lifetime_months, 2)
    ltv_cac_ratio = round(ltv / cac, 2) if cac > 0 else 0.0
    payback_months = round(cac / arpu, 2) if arpu > 0 else 0.0

    ltv_cac_health = "green" if ltv_cac_ratio >= 3.0 else ("amber" if ltv_cac_ratio >= 2.0 else "red")
    payback_health = "green" if payback_months < 12 else ("amber" if payback_months <= 18 else "red")

    health_ranks = {"green": 0, "amber": 1, "red": 2}
    overall = max([ltv_cac_health, payback_health], key=lambda h: health_ranks[h])

    # Benchmark context string
    ltv_label = "exceptional" if ltv_cac_ratio >= 5 else ("strong" if ltv_cac_ratio >= 3 else ("borderline" if ltv_cac_ratio >= 2 else "below benchmark"))
    payback_label = "best-in-class" if payback_months < 6 else ("strong" if payback_months < 12 else ("borderline" if payback_months <= 18 else "above benchmark"))
    benchmark_context = (
        f"LTV:CAC of {ltv_cac_ratio:.1f}x is {ltv_label} (benchmark: >3x green). "
        f"Payback period of {payback_months:.1f} months is {payback_label} (benchmark: <12 months green)."
    )

    # Deterministic recommendations
    recs = []
    if ltv_cac_ratio < 2.0:
        recs.append("CAC exceeds half of LTV — review marketing channel efficiency immediately")
    elif ltv_cac_ratio < 3.0:
        recs.append("LTV:CAC is borderline — focus on either increasing ARPU or reducing CAC before scaling spend")
    else:
        recs.append(f"LTV:CAC of {ltv_cac_ratio:.1f}x is strong — you can confidently scale acquisition spend")

    if payback_months > 18:
        recs.append("Payback period exceeds 18 months — evaluate high-CAC channels and reallocate to lower-cost sources")
    elif payback_months > 12:
        recs.append("Payback period is borderline — aim to bring it below 12 months through pricing or conversion improvements")
    else:
        recs.append(f"Payback of {payback_months:.1f} months is healthy — each acquired customer is in profit quickly")

    if overall == "green":
        recs.append("Unit economics support aggressive growth — increase acquisition budget with confidence")

    return {
        "cac": cac,
        "ltv": ltv,
        "ltv_cac_ratio": ltv_cac_ratio,
        "payback_months": payback_months,
        "total_spend_analyzed": round(total_spend, 2),
        "total_new_customers_analyzed": int(total_customers),
        "arpu": arpu,
        "lifetime_months": lifetime_months,
        "ltv_cac_health": ltv_cac_health,
        "payback_health": payback_health,
        "health": overall,
        "benchmark_context": benchmark_context,
        "recommendations": recs,
    }
