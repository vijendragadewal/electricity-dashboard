"""
Wind Forecast Accuracy Application - Backend API
Focus: Accurate retrieval, alignment and quantitative evaluation of
UK wind generation forecasts (WINDFOR) vs actuals (FUELHH) from Elexon BMRS.
Scoped to January 2026 data relevant for day-ahead market decisions.
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any
import httpx
import pandas as pd
import numpy as np
from functools import lru_cache
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="UK Wind Forecast Accuracy API",
    description="Accurate wind generation forecast vs actual analysis for day-ahead market decisions (Jan 2026)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
JAN_2026_START = date(2026, 1, 1)
JAN_2026_END = date(2026, 1, 31)


def parse_dt(s: str) -> datetime:
    """Parse ISO datetime robustly."""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s).astimezone(timezone.utc)


async def fetch_json(client: httpx.AsyncClient, url: str, params: dict) -> Any:
    """Fetch with basic error handling and logging."""
    try:
        resp = await client.get(url, params=params, timeout=60.0)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        return data
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error {e.response.status_code} for {url}: {e.response.text[:300]}")
        raise HTTPException(status_code=502, detail=f"Upstream API error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Fetch error for {url}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {str(e)}")


async def get_actuals(start: date, end: date) -> pd.DataFrame:
    """
    Fetch FUELHH wind actuals for settlement dates [start, end].
    Resolution: 30 minutes. generation in MW.
    """
    async with httpx.AsyncClient() as client:
        params = {
            "settlementDateFrom": start.isoformat(),
            "settlementDateTo": end.isoformat(),
            "fuelType": "WIND",
            "format": "json"
        }
        raw = await fetch_json(client, f"{BASE_URL}/datasets/FUELHH", params)

    if not raw:
        return pd.DataFrame(columns=["startTime", "generation", "settlementDate", "settlementPeriod"])

    records = []
    for row in raw:
        if row.get("fuelType") != "WIND":
            continue
        records.append({
            "startTime": parse_dt(row["startTime"]),
            "generation": float(row["generation"]),
            "settlementDate": row.get("settlementDate"),
            "settlementPeriod": row.get("settlementPeriod"),
            "publishTime": parse_dt(row["publishTime"]) if row.get("publishTime") else None
        })
    df = pd.DataFrame(records)
    if df.empty:
        return df
    df = df.sort_values("startTime").drop_duplicates(subset=["startTime"], keep="last")
    return df.reset_index(drop=True)



async def get_forecasts(
    publish_from: datetime,
    publish_to: datetime
) -> pd.DataFrame:
    """
    Fetch WINDFOR forecasts in smaller date ranges
    to respect Elexon's maximum 7-day range.
    """

    raw = []
    cursor = publish_from

    async with httpx.AsyncClient() as client:
        while cursor < publish_to:
            # Keep each request safely below 7 days
            chunk_to = min(
                cursor + timedelta(days=6),
                publish_to
            )

            params = {
                "publishDateTimeFrom": cursor.strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
                "publishDateTimeTo": chunk_to.strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
                "format": "json"
            }

            logger.info(
                "Fetching forecasts: %s to %s",
                params["publishDateTimeFrom"],
                params["publishDateTimeTo"]
            )

            chunk_data = await fetch_json(
                client,
                f"{BASE_URL}/datasets/WINDFOR",
                params
            )

            if chunk_data:
                raw.extend(chunk_data)

            # The next request starts at the previous end.
            # Any overlapping records are deduplicated below.
            cursor = chunk_to

    if not raw:
        return pd.DataFrame(
            columns=["publishTime", "startTime", "generation"]
        )

    records = []

    for row in raw:
        records.append({
            "publishTime": parse_dt(row["publishTime"]),
            "startTime": parse_dt(row["startTime"]),
            "generation": float(row["generation"])
        })

    df = pd.DataFrame(records)

    df = df.sort_values(
        ["publishTime", "startTime"]
    ).drop_duplicates(
        subset=["publishTime", "startTime"],
        keep="last"
    )

    return df.reset_index(drop=True)


def select_day_ahead_forecast(forecasts: pd.DataFrame, delivery_date: date) -> pd.DataFrame:
    """
    For a given delivery day, select the latest forecast that would have been
    available for day-ahead market decisions (typically published on D-1).

    Day-ahead decisions are made the day before delivery. We take the most recent
    publishTime that is strictly before the start of the delivery day (00:00 UTC of delivery_date).
    """
    if forecasts.empty:
        return pd.DataFrame()

    delivery_start = datetime.combine(delivery_date, datetime.min.time(), tzinfo=timezone.utc)
    # Forecasts available before delivery day starts
    available = forecasts[forecasts["publishTime"] < delivery_start].copy()
    if available.empty:
        return pd.DataFrame()

    # Latest publish time available before delivery
    latest_publish = available["publishTime"].max()
    selected = available[available["publishTime"] == latest_publish].copy()

    # Only keep targets that fall on the delivery day (or relevant horizon)
    delivery_end = delivery_start + timedelta(days=1)
    selected = selected[
        (selected["startTime"] >= delivery_start) &
        (selected["startTime"] < delivery_end)
    ].copy()

    selected = selected.sort_values("startTime").reset_index(drop=True)
    selected["selectedPublishTime"] = latest_publish
    return selected


def align_and_compute_errors(forecast_df: pd.DataFrame, actual_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Align forecast and actual on startTime (nearest 30-min for forecasts if needed)
    and compute quantitative accuracy metrics.
    """
    if forecast_df.empty or actual_df.empty:
        return {
            "aligned": [],
            "metrics": {},
            "message": "Insufficient data for alignment"
        }

    # Round forecast startTimes to nearest 30 minutes for matching with FUELHH
    f = forecast_df.copy()
    f["startTime_rounded"] = f["startTime"].dt.round("30min")

    a = actual_df.copy()
    a = a.rename(columns={"generation": "actual", "startTime": "startTime_actual"})

    merged = pd.merge(
        f,
        a[["startTime_actual", "actual"]],
        left_on="startTime_rounded",
        right_on="startTime_actual",
        how="inner"
    )

    if merged.empty:
        return {
            "aligned": [],
            "metrics": {},
            "message": "No overlapping timestamps after alignment"
        }

    merged["error"] = merged["generation"] - merged["actual"]  # forecast - actual
    merged["abs_error"] = merged["error"].abs()
    merged["pct_error"] = np.where(
        merged["actual"] != 0,
        (merged["error"] / merged["actual"]) * 100,
        np.nan
    )
    merged["abs_pct_error"] = merged["pct_error"].abs()

    n = len(merged)
    mae = float(merged["abs_error"].mean())
    rmse = float(np.sqrt((merged["error"] ** 2).mean()))
    mape = float(merged["abs_pct_error"].mean()) if not merged["abs_pct_error"].isna().all() else None
    bias = float(merged["error"].mean())  # positive = over-forecast
    max_ae = float(merged["abs_error"].max())

    # Additional useful stats
    actual_mean = float(merged["actual"].mean())
    forecast_mean = float(merged["generation"].mean())

    aligned_records = []
    for _, row in merged.iterrows():
        aligned_records.append({
            "startTime": row["startTime"].isoformat(),
            "forecast": round(float(row["generation"]), 1),
            "actual": round(float(row["actual"]), 1),
            "error": round(float(row["error"]), 1),
            "absError": round(float(row["abs_error"]), 1),
            "pctError": round(float(row["pct_error"]), 2) if pd.notna(row["pct_error"]) else None
        })

    return {
        "aligned": aligned_records,
        "metrics": {
            "n": n,
            "mae_mw": round(mae, 2),
            "rmse_mw": round(rmse, 2),
            "mape_pct": round(mape, 2) if mape is not None else None,
            "bias_mw": round(bias, 2),
            "max_abs_error_mw": round(max_ae, 2),
            "mean_actual_mw": round(actual_mean, 1),
            "mean_forecast_mw": round(forecast_mean, 1)
        },
        "message": "OK"
    }


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "scope": "January 2026 UK Wind (Elexon)"}


@app.get("/actuals")
@app.get("/api/actuals")
async def api_actuals(
    start: date = Query(..., description="Settlement date from (YYYY-MM-DD)"),
    end: date = Query(..., description="Settlement date to (YYYY-MM-DD)")
):
    """Raw wind actual generation (FUELHH) for date range."""
    if start < JAN_2026_START or end > JAN_2026_END:
        raise HTTPException(400, "Only January 2026 data is in scope for this pilot")
    if end < start:
        raise HTTPException(400, "end must be >= start")
    if (end - start).days > 14:
        raise HTTPException(400, "Maximum 14-day range")

    df = await get_actuals(start, end)
    records = [
        {
            "startTime": r["startTime"].isoformat(),
            "generation": round(r["generation"], 1),
            "settlementDate": r["settlementDate"],
            "settlementPeriod": r["settlementPeriod"]
        }
        for _, r in df.iterrows()
    ]
    return {"count": len(records), "data": records}

@app.get("/forecasts")
@app.get("/api/forecasts")
async def api_forecasts(
    publish_from: datetime = Query(..., description="Publish time from (ISO)"),
    publish_to: datetime = Query(..., description="Publish time to (ISO)")
):
    """Raw WINDFOR forecasts published in the given window."""
    df = await get_forecasts(publish_from, publish_to)
    records = [
        {
            "publishTime": r["publishTime"].isoformat(),
            "startTime": r["startTime"].isoformat(),
            "generation": round(r["generation"], 1)
        }
        for _, r in df.iterrows()
    ]
    return {"count": len(records), "data": records}


@app.get("/day-ahead")
@app.get("/api/day-ahead")
async def api_day_ahead(
    delivery_date: date = Query(..., description="Delivery day (YYYY-MM-DD) for which day-ahead decision is made")
):
    """
    Latest forecast available for day-ahead decision on the given delivery day,
    plus actuals and quantitative accuracy metrics.
    """
    if delivery_date < JAN_2026_START or delivery_date > JAN_2026_END:
        raise HTTPException(400, "Only January 2026 is in scope")

    # Fetch forecasts published from a few days before up to the delivery day
    publish_from = datetime.combine(delivery_date - timedelta(days=3), datetime.min.time(), tzinfo=timezone.utc)
    publish_to = datetime.combine(delivery_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

    forecasts = await get_forecasts(publish_from, publish_to)
    selected = select_day_ahead_forecast(forecasts, delivery_date)

    # Actuals for the delivery day
    actuals = await get_actuals(delivery_date, delivery_date)

    result = align_and_compute_errors(selected, actuals)

    # Also return the full selected forecast series (even if no actual match)
    forecast_series = [
        {
            "startTime": r["startTime"].isoformat(),
            "generation": round(float(r["generation"]), 1),
            "publishTime": r["selectedPublishTime"].isoformat()
        }
        for _, r in selected.iterrows()
    ]

    return {
        "deliveryDate": delivery_date.isoformat(),
        "selectedPublishTime": selected["selectedPublishTime"].iloc[0].isoformat() if not selected.empty else None,
        "forecastSeries": forecast_series,
        "aligned": result["aligned"],
        "metrics": result["metrics"],
        "message": result["message"]
    }

@app.get("/accuracy-summary")
@app.get("/api/accuracy-summary")
async def api_accuracy_summary(
    start: date = Query(date(2026, 1, 1)),
    end: date = Query(date(2026, 1, 7))
):
    """
    Compute day-ahead accuracy metrics for each delivery day in [start, end].
    Useful for overall quantitative evaluation of forecast performance.
    """
    if start < JAN_2026_START or end > JAN_2026_END:
        raise HTTPException(400, "Only January 2026 is in scope")
    if (end - start).days > 14:
        raise HTTPException(400, "Maximum 14-day range for summary")

    # Pre-fetch a wider window of forecasts once
    publish_from = datetime.combine(start - timedelta(days=4), datetime.min.time(), tzinfo=timezone.utc)
    publish_to = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    all_forecasts = await get_forecasts(publish_from, publish_to)
    all_actuals = await get_actuals(start, end)

    daily = []
    current = start
    while current <= end:
        selected = select_day_ahead_forecast(all_forecasts, current)
        day_actuals = all_actuals[
            (all_actuals["startTime"] >= datetime.combine(current, datetime.min.time(), tzinfo=timezone.utc)) &
            (all_actuals["startTime"] < datetime.combine(current + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
        ]
        res = align_and_compute_errors(selected, day_actuals)
        daily.append({
            "deliveryDate": current.isoformat(),
            "selectedPublishTime": selected["selectedPublishTime"].iloc[0].isoformat() if not selected.empty else None,
            "metrics": res["metrics"],
            "nPoints": res["metrics"].get("n", 0)
        })
        current += timedelta(days=1)

    # Aggregate overall
    all_maes = [d["metrics"]["mae_mw"] for d in daily if d["metrics"].get("mae_mw") is not None]
    all_rmses = [d["metrics"]["rmse_mw"] for d in daily if d["metrics"].get("rmse_mw") is not None]
    all_mapes = [d["metrics"]["mape_pct"] for d in daily if d["metrics"].get("mape_pct") is not None]
    all_biases = [d["metrics"]["bias_mw"] for d in daily if d["metrics"].get("bias_mw") is not None]

    overall = {
        "days": len(daily),
        "mean_mae_mw": round(float(np.mean(all_maes)), 2) if all_maes else None,
        "mean_rmse_mw": round(float(np.mean(all_rmses)), 2) if all_rmses else None,
        "mean_mape_pct": round(float(np.mean(all_mapes)), 2) if all_mapes else None,
        "mean_bias_mw": round(float(np.mean(all_biases)), 2) if all_biases else None
    }

    return {
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "overall": overall,
        "daily": daily
    }

@app.get("/available-dates")
@app.get("/api/available-dates")
async def available_dates():
    """Simple helper: list of dates in January 2026."""
    return {
        "start": "2026-01-01",
        "end": "2026-01-31",
        "note": "Pilot scoped to January 2026 for day-ahead wind procurement decisions"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
