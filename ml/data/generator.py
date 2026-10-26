"""
Synthetic Queue Dataset Generator for Government Document-Verification Offices.
Produces realistic time-series observations with peaks, outages, and service completions.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import random
import csv
import os
import pandas as pd


def generate_synthetic_queue_records(
    days: int = 14,
    interval_minutes: int = 15,
    seed: int = 42,
) -> List[Dict[str, Any]]:
    """
    Generate synthetic queue records for 4 government departments:
      1: Certificate & Document Services
      2: Revenue & Tax Services
      3: Identity & Application Verification
      4: General Citizen Support
    """
    random.seed(seed)
    records = []

    # Office open 08:30 to 17:30 Monday-Saturday (closed Sunday)
    end_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start_time = end_time - timedelta(days=days)

    dept_params = {
        1: {"base_arrivals": 10, "avg_service_s": 300.0, "counters": 5, "name": "CDS"},
        2: {"base_arrivals": 7, "avg_service_s": 360.0, "counters": 4, "name": "RTS"},
        3: {"base_arrivals": 14, "avg_service_s": 240.0, "counters": 6, "name": "IAV"},
        4: {"base_arrivals": 5, "avg_service_s": 180.0, "counters": 3, "name": "GCS"},
    }

    current_queues = {dept_id: 0 for dept_id in dept_params}

    curr_time = start_time
    step_delta = timedelta(minutes=interval_minutes)

    while curr_time <= end_time:
        weekday = curr_time.weekday()
        hour = curr_time.hour
        minute = curr_time.minute

        # Sunday office closed
        is_open = (weekday < 6) and (9 <= hour < 17)

        for dept_id, params in dept_params.items():
            if not is_open:
                # Closed: zero arrivals, queues drain
                current_queues[dept_id] = 0
                records.append({
                    "timestamp": curr_time.isoformat(),
                    "department_id": dept_id,
                    "service_type": params["name"],
                    "arrivals": 0,
                    "people_waiting": 0,
                    "active_counters": 0,
                    "completed_services": 0,
                    "average_service_time_seconds": params["avg_service_s"],
                    "observed_waiting_time_seconds": 0.0,
                    "counter_status": "closed",
                    "source": "synthetic",
                })
                continue

            # Diurnal peak multiplier
            # Peak 1: 10:00 - 11:30 (1.8x), Peak 2: 14:00 - 15:30 (1.5x), Lunch dip: 12:30 - 13:30 (0.6x)
            time_decimal = hour + minute / 60.0
            if 10.0 <= time_decimal <= 11.5:
                peak_mult = 1.85
            elif 14.0 <= time_decimal <= 15.5:
                peak_mult = 1.50
            elif 12.5 <= time_decimal <= 13.5:
                peak_mult = 0.60
            else:
                peak_mult = 1.0

            # Monday surge
            if weekday == 0:
                peak_mult *= 1.25

            # Random Poisson arrivals
            mean_arr = params["base_arrivals"] * peak_mult * (interval_minutes / 15.0)
            arrivals = max(0, int(random.gauss(mean_arr, max(1.0, mean_arr * 0.15))))

            # Occasional counter disruption (2% chance of 1 counter temporarily down)
            open_counters = params["counters"]
            if random.random() < 0.03:
                open_counters = max(1, open_counters - 1)

            # Capacity per interval
            service_sec = max(60.0, random.gauss(params["avg_service_s"], params["avg_service_s"] * 0.10))
            max_served = int(open_counters * (interval_minutes * 60.0 / service_sec))

            prev_queue = current_queues[dept_id]
            current_total = prev_queue + arrivals
            completions = min(current_total, max_served)
            new_queue = max(0, current_total - completions)
            current_queues[dept_id] = new_queue

            # Little's law waiting time estimate
            lam_rate = max(arrivals / (interval_minutes * 60.0), 0.001)
            wait_sec = min(3600.0, new_queue / (lam_rate * open_counters))

            records.append({
                "timestamp": curr_time.isoformat(),
                "department_id": dept_id,
                "service_type": params["name"],
                "arrivals": arrivals,
                "people_waiting": new_queue,
                "active_counters": open_counters,
                "completed_services": completions,
                "average_service_time_seconds": round(service_sec, 1),
                "observed_waiting_time_seconds": round(wait_sec, 1),
                "counter_status": "open",
                "source": "synthetic",
            })

        curr_time += step_delta

    return records


def export_sample_dataset_csv(filepath: str, days: int = 14, seed: int = 42):
    """Generate and write sample CSV file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    records = generate_synthetic_queue_records(days=days, seed=seed)
    if not records:
        return

    fieldnames = list(records[0].keys())
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"Sample dataset written to {filepath} ({len(records)} rows)")
