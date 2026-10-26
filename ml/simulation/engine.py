"""
Discrete-Event Queue Simulation Engine with Multi-Run Monte Carlo Strategy Evaluation.
Compares Fixed, Rule-Based, and Optimization-Based dynamic resource allocation.
"""
from typing import Dict, Any, List, Optional
import numpy as np


class QueueSimulationEngine:
    """Discrete-event queue simulator comparing dynamic staffing policies."""

    def __init__(self, base_seed: int = 42):
        self.base_seed = base_seed

    def simulate_strategy(
        self,
        strategy: str,
        arrival_rate_per_hour: float = 30.0,
        num_counters: int = 3,
        avg_service_time_minutes: float = 8.0,
        service_time_std_minutes: float = 2.0,
        duration_minutes: int = 480,
        seed: int = 42,
    ) -> Dict[str, Any]:
        """
        Run a single discrete-event simulation trial for a given strategy.
        Strategies:
          - 'fixed': Static allocation of num_counters
          - 'rule_based': Reactively scales counters up when queue > 12, scales down when queue < 3
          - 'optimization': Proactively optimizes counters every 30 min using Erlang C
        """
        rng = np.random.default_rng(seed)
        step_minutes = 1
        steps = duration_minutes
        lam_per_min = arrival_rate_per_hour / 60.0

        def peak_multiplier(t_min: int) -> float:
            h = (t_min / 60.0) % 24.0
            if 1.0 <= h < 3.0:    # Morning peak (e.g. 10am-12pm)
                return 1.85
            elif 5.0 <= h < 7.0:  # Afternoon peak (e.g. 2pm-4pm)
                return 1.45
            elif 3.0 <= h < 4.0:  # Lunch lull
                return 0.70
            return 1.0

        counters_open = num_counters
        queue = []  # timestamps when waiting customers arrived
        completed_waits = []
        counter_busy_time = {c: 0 for c in range(1, num_counters + 4)}
        counter_current_finish = {c: 0 for c in range(1, num_counters + 4)}
        max_queue_len = 0
        total_arrivals = 0
        total_served = 0

        for t in range(steps):
            # 1. Strategy dynamic adjustment
            if strategy == "rule_based":
                if len(queue) > 12 and counters_open < num_counters + 2:
                    counters_open = min(counters_open + 1, num_counters + 2)
                elif len(queue) < 3 and counters_open > 1:
                    counters_open = max(1, counters_open - 1)

            elif strategy == "optimization":
                if t % 30 == 0:  # Proactive re-evaluation every 30 mins
                    eff_rate = lam_per_min * peak_multiplier(t)
                    mu_per_min = 1.0 / max(avg_service_time_minutes, 0.5)
                    # Find min servers where rho < 0.82
                    chosen_c = num_counters
                    for c_candidate in range(1, num_counters + 3):
                        rho = eff_rate / (c_candidate * mu_per_min)
                        if rho < 0.82:
                            chosen_c = c_candidate
                            break
                    counters_open = chosen_c

            # 2. Customer arrivals
            curr_rate = lam_per_min * peak_multiplier(t)
            n_arrivals = int(rng.poisson(curr_rate))
            total_arrivals += n_arrivals
            for _ in range(n_arrivals):
                queue.append(t)

            max_queue_len = max(max_queue_len, len(queue))

            # 3. Process services across open counters
            for c in range(1, counters_open + 1):
                if counter_current_finish[c] <= t:
                    if queue:
                        arrival_time = queue.pop(0)
                        wait = (t - arrival_time) * 60.0  # seconds
                        completed_waits.append(wait)
                        serv_dur = max(1.0, rng.normal(avg_service_time_minutes, service_time_std_minutes))
                        counter_current_finish[c] = t + int(np.ceil(serv_dur))
                        counter_busy_time[c] += int(np.ceil(serv_dur))
                        total_served += 1

        # Calculate metrics
        waits_arr = np.array(completed_waits) if completed_waits else np.array([0.0])
        mean_wait = float(np.mean(waits_arr))
        median_wait = float(np.median(waits_arr))
        p90_wait = float(np.percentile(waits_arr, 90))

        hours = duration_minutes / 60.0
        throughput = total_served / max(hours, 0.1)

        total_counter_minutes = counters_open * duration_minutes
        busy_minutes = sum(counter_busy_time[c] for c in range(1, counters_open + 1))
        utilization = float(min(1.0, busy_minutes / max(total_counter_minutes, 1)))

        # Service level: % of customers waiting < 15 minutes (900s)
        service_level = float(np.mean(waits_arr < 900.0) * 100.0) if len(waits_arr) > 0 else 100.0

        return {
            "strategy": strategy,
            "mean_wait_seconds": round(mean_wait, 1),
            "median_wait_seconds": round(median_wait, 1),
            "p90_wait_seconds": round(p90_wait, 1),
            "max_queue_length": int(max_queue_len),
            "customers_served": int(total_served),
            "total_arrivals": int(total_arrivals),
            "throughput_per_hour": round(throughput, 1),
            "counter_utilization": round(utilization, 3),
            "service_level_attained": round(service_level, 1),
        }

    def run_comparative_experiment(
        self,
        strategies: List[str] = None,
        num_runs: int = 5,
        arrival_rate_per_hour: float = 30.0,
        num_counters: int = 3,
        avg_service_time_minutes: float = 8.0,
        service_time_std_minutes: float = 2.0,
        duration_minutes: int = 480,
    ) -> Dict[str, Any]:
        """
        Execute repeated Monte Carlo simulation runs across strategies using identical random seeds.
        Returns summary statistics (mean, std dev) for rigorous research comparison.
        """
        if strategies is None:
            strategies = ["fixed", "rule_based", "optimization"]

        strategy_results: Dict[str, List[Dict[str, Any]]] = {s: [] for s in strategies}

        for run_idx in range(num_runs):
            seed = self.base_seed + run_idx * 17
            for strat in strategies:
                res = self.simulate_strategy(
                    strategy=strat,
                    arrival_rate_per_hour=arrival_rate_per_hour,
                    num_counters=num_counters,
                    avg_service_time_minutes=avg_service_time_minutes,
                    service_time_std_minutes=service_time_std_minutes,
                    duration_minutes=duration_minutes,
                    seed=seed,
                )
                strategy_results[strat].append(res)

        # Aggregate summary statistics
        summary = {}
        for strat in strategies:
            trials = strategy_results[strat]
            means = [t["mean_wait_seconds"] for t in trials]
            p90s = [t["p90_wait_seconds"] for t in trials]
            utils = [t["counter_utilization"] for t in trials]
            thru = [t["throughput_per_hour"] for t in trials]
            sls = [t["service_level_attained"] for t in trials]

            summary[strat] = {
                "strategy": strat,
                "mean_wait_avg_seconds": round(float(np.mean(means)), 1),
                "mean_wait_std_seconds": round(float(np.std(means)), 1),
                "p90_wait_avg_seconds": round(float(np.mean(p90s)), 1),
                "counter_utilization_avg": round(float(np.mean(utils)), 3),
                "throughput_avg": round(float(np.mean(thru)), 1),
                "service_level_avg": round(float(np.mean(sls)), 1),
                "num_trials": num_runs,
                "individual_runs": trials,
            }

        return summary
