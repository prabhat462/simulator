"""
GMV Impact Calculator.
Translates SR uplift to monetary impact.
"""

from typing import Dict, Optional


def calculate_gmv_impact(
    sr_uplift: float,
    monthly_volume: int,
    avg_transaction_value: float,
    current_baseline_sr: float = 0.85,
) -> Dict:
    """
    Calculate projected GMV savings from SR uplift.

    Args:
        sr_uplift: Absolute SR improvement (e.g. 0.012 = 1.2%)
        monthly_volume: Monthly transaction count
        avg_transaction_value: Average transaction value in INR
        current_baseline_sr: Current baseline SR
    """
    monthly_saved_txns = sr_uplift * monthly_volume
    monthly_gmv_saved = monthly_saved_txns * avg_transaction_value
    annual_gmv_saved = monthly_gmv_saved * 12

    return {
        "sr_uplift_pct": round(sr_uplift * 100, 2),
        "monthly_volume": monthly_volume,
        "avg_transaction_value": round(avg_transaction_value, 2),
        "current_baseline_sr": round(current_baseline_sr, 4),
        "projected_sr": round(current_baseline_sr + sr_uplift, 4),
        "monthly_saved_transactions": int(monthly_saved_txns),
        "monthly_gmv_saved_inr": round(monthly_gmv_saved, 2),
        "annual_gmv_saved_inr": round(annual_gmv_saved, 2),
        "monthly_gmv_saved_crore": round(monthly_gmv_saved / 10_000_000, 2),
        "annual_gmv_saved_crore": round(annual_gmv_saved / 10_000_000, 2),
    }
