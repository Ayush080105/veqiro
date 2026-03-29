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
