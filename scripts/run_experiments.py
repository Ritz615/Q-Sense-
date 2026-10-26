"""
Research Benchmark & Sensitivity Analysis Experiment Runner.
Compares Fixed, Rule-Based, and Optimization-Based allocation across repeated Monte Carlo runs.
Usage: python scripts/run_experiments.py
"""
import sys
import os
import json
from datetime import datetime, timezone

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from ml.simulation.engine import QueueSimulationEngine


def run_benchmark():
    print("=" * 70)
    print("  Q-Sense Research Experiment: Comparative Strategy Evaluation")
    print("=" * 70)

    engine = QueueSimulationEngine(base_seed=100)

    # 1. Base comparative experiment across 5 repeated runs (seeds 100, 117, 134, 151, 168)
    print("\n1. Running Primary Comparative Evaluation (5 trials per strategy)...")
    base_results = engine.run_comparative_experiment(
        strategies=["fixed", "rule_based", "optimization"],
        num_runs=5,
        arrival_rate_per_hour=35.0,
        num_counters=3,
        avg_service_time_minutes=7.5,
        service_time_std_minutes=2.0,
        duration_minutes=480,
    )

    for strat, data in base_results.items():
        print(f"  [{strat.upper():<12}] Mean Wait: {data['mean_wait_avg_seconds']:.1f}s (±{data['mean_wait_std_seconds']:.1f}s) | "
              f"P90 Wait: {data['p90_wait_avg_seconds']:.1f}s | "
              f"Utilization: {data['counter_utilization_avg']*100:.1f}% | "
              f"Service Level: {data['service_level_avg']:.1f}%")

    # 2. Sensitivity Analysis: Varying Arrival Rates (20, 30, 40, 50 arrivals/hr)
    print("\n2. Running Sensitivity Analysis: Arrival Rate Surge...")
    surge_results = {}
    for arr_rate in [20.0, 30.0, 40.0, 50.0]:
        res = engine.run_comparative_experiment(
            strategies=["fixed", "rule_based", "optimization"],
            num_runs=3,
            arrival_rate_per_hour=arr_rate,
            num_counters=3,
            avg_service_time_minutes=7.5,
            duration_minutes=480,
        )
        surge_results[f"arrival_rate_{int(arr_rate)}"] = {
            s: {
                "mean_wait_seconds": res[s]["mean_wait_avg_seconds"],
                "utilization": res[s]["counter_utilization_avg"],
                "service_level": res[s]["service_level_avg"],
            }
            for s in res
        }
        print(f"  Arrivals {int(arr_rate)}/hr -> Fixed Wait: {res['fixed']['mean_wait_avg_seconds']:.0f}s | "
              f"Rule-Based: {res['rule_based']['mean_wait_avg_seconds']:.0f}s | "
              f"Optimization: {res['optimization']['mean_wait_avg_seconds']:.0f}s")

    # 3. Sensitivity Analysis: Service Duration (5 min, 7.5 min, 10 min)
    print("\n3. Running Sensitivity Analysis: Service Duration Variation...")
    service_results = {}
    for svc_min in [5.0, 7.5, 10.0]:
        res = engine.run_comparative_experiment(
            strategies=["fixed", "rule_based", "optimization"],
            num_runs=3,
            arrival_rate_per_hour=35.0,
            num_counters=3,
            avg_service_time_minutes=svc_min,
            duration_minutes=480,
        )
        service_results[f"service_time_{svc_min}m"] = {
            s: {
                "mean_wait_seconds": res[s]["mean_wait_avg_seconds"],
                "utilization": res[s]["counter_utilization_avg"],
                "service_level": res[s]["service_level_avg"],
            }
            for s in res
        }

    # Compile research artifact
    experiment_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "primary_benchmark": base_results,
        "sensitivity_arrival_rates": surge_results,
        "sensitivity_service_durations": service_results,
        "hypotheses_evaluated": {
            "H1_wait_reduction": "Forecast-informed dynamic allocation reduces mean and P90 customer waiting times compared to fixed counters during demand peaks.",
            "H2_utilization_stability": "Dynamic allocation prevents counter starvation during off-peak periods without inducing excessive queue buildup.",
        },
        "simulation_parameters": {
            "default_arrival_rate_per_hour": 35.0,
            "default_avg_service_minutes": 7.5,
            "default_counters": 3,
            "simulation_window_hours": 8,
            "reproducible_seed": 100,
        },
    }

    out_file = os.path.join(workspace_root, "research", "experimental_results.json")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(experiment_payload, f, indent=2)

    print("\n" + "=" * 70)
    print(f"Experiments successfully completed! Saved to {out_file}")
    print("=" * 70)


if __name__ == "__main__":
    run_benchmark()
