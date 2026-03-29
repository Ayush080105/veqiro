from core.models import DataPoint


async def forecast_metric(
    historical_data: list[DataPoint],
    horizon_days: int = 30,
) -> dict:
    """Forecast a metric using Prophet (if 30+ points) or linear regression.

    Returns: {
        forecast: [{date, value, lower_bound, upper_bound}],
        confidence: float,
        methodology: str,
        summary: str,
    }
    """
    if not historical_data:
        return {"forecast": [], "confidence": 0.0, "methodology": "none", "summary": "No data provided."}

    sorted_data = sorted(historical_data, key=lambda d: d.date)

    if len(sorted_data) >= 30:
        try:
            return await _prophet_forecast(sorted_data, horizon_days)
        except Exception:
            pass  # Fall through to linear regression

    return await _linear_forecast(sorted_data, horizon_days)


async def _prophet_forecast(data: list[DataPoint], horizon_days: int) -> dict:
    """Use Facebook Prophet for forecasting."""
    import asyncio
    from datetime import datetime, timedelta

    def _run():
        import pandas as pd
        from prophet import Prophet

        df = pd.DataFrame({"ds": [d.date for d in data], "y": [d.value for d in data]})
        df["ds"] = pd.to_datetime(df["ds"])

        model = Prophet(interval_width=0.80, daily_seasonality=False)
        model.fit(df)

        last_date = df["ds"].max()
        future_dates = [last_date + timedelta(days=i + 1) for i in range(horizon_days)]
        future = pd.DataFrame({"ds": future_dates})
        forecast_df = model.predict(future)

        result = []
        for _, row in forecast_df.iterrows():
            result.append({
                "date": row["ds"].strftime("%Y-%m-%d"),
                "value": round(float(row["yhat"]), 2),
                "lower_bound": round(float(row["yhat_lower"]), 2),
                "upper_bound": round(float(row["yhat_upper"]), 2),
            })
        return result

    forecast_points = await asyncio.to_thread(_run)
    last_val = data[-1].value
    forecast_val = forecast_points[-1]["value"] if forecast_points else last_val
    pct_change = ((forecast_val - last_val) / last_val * 100) if last_val else 0

    return {
        "forecast": forecast_points,
        "confidence": 0.80,
        "methodology": "prophet",
        "summary": (
            f"Prophet model forecast over {horizon_days} days. "
            f"Projected change: {pct_change:+.1f}% from current value of {last_val:,.0f}."
        ),
    }


async def _linear_forecast(data: list[DataPoint], horizon_days: int) -> dict:
    """Use numpy polyfit linear regression as fallback."""
    from datetime import datetime, timedelta

    try:
        import numpy as np
        values = np.array([d.value for d in data])
        x = np.arange(len(values))
        coeffs = np.polyfit(x, values, 1)
        slope, intercept = coeffs

        last_date_str = data[-1].date
        try:
            last_date = datetime.strptime(last_date_str, "%Y-%m-%d")
        except Exception:
            last_date = datetime.utcnow()

        forecast_points = []
        for i in range(1, horizon_days + 1):
            x_val = len(values) + i - 1
            y_val = slope * x_val + intercept
            std = float(np.std(values)) * 0.5
            forecast_points.append({
                "date": (last_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "value": round(float(y_val), 2),
                "lower_bound": round(float(y_val - std), 2),
                "upper_bound": round(float(y_val + std), 2),
            })

        last_val = float(values[-1])
        forecast_val = forecast_points[-1]["value"] if forecast_points else last_val
        pct_change = ((forecast_val - last_val) / last_val * 100) if last_val else 0

        return {
            "forecast": forecast_points,
            "confidence": 0.65,
            "methodology": "linear_regression",
            "summary": (
                f"Linear regression forecast over {horizon_days} days. "
                f"Trend slope: {slope:+.2f}/day. "
                f"Projected change: {pct_change:+.1f}% from {last_val:,.0f}."
            ),
        }
    except ImportError:
        # Pure Python fallback
        n = len(data)
        x_vals = list(range(n))
        y_vals = [d.value for d in data]
        x_mean = sum(x_vals) / n
        y_mean = sum(y_vals) / n
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, y_vals))
        denominator = sum((x - x_mean) ** 2 for x in x_vals)
        slope = numerator / denominator if denominator else 0
        intercept = y_mean - slope * x_mean

        from datetime import datetime, timedelta
        try:
            last_date = datetime.strptime(data[-1].date, "%Y-%m-%d")
        except Exception:
            last_date = datetime.utcnow()

        forecast_points = []
        for i in range(1, horizon_days + 1):
            x_val = n + i - 1
            y_val = slope * x_val + intercept
            forecast_points.append({
                "date": (last_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "value": round(y_val, 2),
                "lower_bound": round(y_val * 0.9, 2),
                "upper_bound": round(y_val * 1.1, 2),
            })

        return {
            "forecast": forecast_points,
            "confidence": 0.60,
            "methodology": "linear_regression_fallback",
            "summary": f"Linear regression over {horizon_days} days with {n} historical points.",
        }
