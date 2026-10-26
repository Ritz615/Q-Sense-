"""
Discrete-Event Simulation Service for what-if scenario comparison.
Implements three strategies: fixed, rule-based, optimization-based.

Uses numpy-based simulation with configurable random seed for reproducibility.
"""
import numpy as np
from typing import Dict, Any


class SimulationService:
    """Runs discrete-event queue simulations for comparative strategy evaluation."""

    def __init__(self, seed: int = 42):
        self.base_seed = seed

    def run_strategy(
        self,
        strategy: str,
        arrival_rate: float = 30.0,
        num_counters: int = 3,
        avg_service_minutes: float = 8.0,
        service_std: float = 2.0,
        duration_minutes: int = 480,
        seed: int = 42,
    ) -> Dict[str, Any]:
        """
        Run a single simulation trial for a given strategy.
        Returns aggregated metrics.

        Strategies:
          - fixed: always use num_counters, no adjustment
          - rule_based: open extra counter if queue > threshold
          - optimization: optimize every 30 min using M/M/c heuristic
        """
        rng = np.random.default_rng(seed)

        interval = 1  # minutes per step
        steps = duration_minutes
        lam = arrival_rate / 60  # arrivals per minute

        # Peak hours (9-11am, 2-4pm relative to start)
        def arrival_multiplier(t_min):
            h = (t_min / 60) % 24
            if 0 <= h < 2 or 5 <= h < 7:  # simulate peak periods within sim window
                return 1.8
            elif 3 <= h < 5:
                return 1.4
            return 1.0

        counters_open = num_counters
        queue_length = 0
        waiting_times = []
        queue_lengths = []
        serving = {}  # counter_id -> time_remaining

        for i in range(1, num_counters + 1):
            serving[i] = 0

        total_arrivals = 0
        total_served = 0

        for t in range(steps):
            # Strategy adjustments
            if strategy == "rule_based":
                if queue_length > 15 and counters_open < num_counters + 2:
                    counters_open = min(counters_open + 1, num_counters + 2)
                    if counters_open not in serving:
                        serving[counters_open] = 0
                elif queue_length < 3 and counters_open > 1:
                    counters_open = max(1, counters_open - 1)

            elif strategy == "optimization":
                if t % 30 == 0:  # re-optimize every 30 min
                    mu = 1.0 / max(avg_service_minutes, 0.01)
                    effective_lam = lam * arrival_multiplier(t)
                    # Simple M/M/c: find min c such that rho < 0.85
                    for c in range(1, num_counters + 3):
                        rho = effective_lam / (c * mu)
                        if rho < 0.85:
                            counters_open = c
                            break
                    # Ensure serving dict has entries
                    for ci in range(1, counters_open + 1):
                        if ci not in serving:
                            serving[ci] = 0

            # Arrivals this step
            arr_rate = lam * arrival_multiplier(t)
            arrivals = int(rng.poisson(arr_rate))
            total_arrivals += arrivals
            queue_length += arrivals

            # Service completions
            completed = 0
            for ci in range(1, counters_open + 1):
                if serving.get(ci, 0) <= 0:
                    if queue_length > 0:
                        # Start serving next customer
                        service_time = max(1, rng.normal(avg_service_minutes, service_std))
                        serving[ci] = int(service_time)
                        queue_length -= 1
                        waiting_time = max(0, queue_length * avg_service_minutes / max(counters_open, 1))
                        waiting_times.append(waiting_time)
                        completed += 1
                else:
                    serving[ci] -= 1

            total_served += completed
            queue_lengths.append(queue_length)

        # Metrics
        wait_arr = np.array(waiting_times) if waiting_times else np.array([0.0])
        mean_wait = float(np.mean(wait_arr)) * 60  # convert to seconds
        median_wait = float(np.median(wait_arr)) * 60
        p90_wait = float(np.percentile(wait_arr, 90)) * 60
        max_q = int(max(queue_lengths)) if queue_lengths else 0

        duration_hours = duration_minutes / 60
        throughput = total_served / max(duration_hours, 0.1)

        # Counter utilization
        avg_serving = total_served / (duration_minutes * counters_open + 1)
        utilization = min(1.0, avg_serving * avg_service_minutes / (duration_minutes / counters_open + 1))
        # Simplified: served/(capacity)
        capacity = counters_open * duration_minutes / avg_service_minutes
        utilization = min(1.0, total_served / max(capacity, 1))

        # Service level: % of customers with wait < 10 min
        service_level = float(np.mean(wait_arr < 10.0)) if len(wait_arr) > 0 else 0.0

        return {
            "mean_wait_seconds": mean_wait,
            "median_wait_seconds": median_wait,
            "p90_wait_seconds": p90_wait,
            "max_queue_length": max_q,
            "customers_served": total_served,
            "throughput_per_hour": throughput,
            "counter_utilization": utilization,
            "service_level_attained": service_level,
            "detailed_results": {
                "total_arrivals": total_arrivals,
                "strategy": strategy,
                "final_counters": counters_open,
            },
        }
