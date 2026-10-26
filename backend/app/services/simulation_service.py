"""
Discrete-Event Simulation Service for what-if scenario comparison.
Implements three strategies: fixed, rule-based, optimization-based.
Uses numpy-based simulation with configurable random seed for reproducibility.
"""
import sys
import os
from typing import Dict, Any, List

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from ml.simulation.engine import QueueSimulationEngine


class SimulationService:
    """Runs discrete-event queue simulations for comparative strategy evaluation."""

    def __init__(self, seed: int = 42):
        self.base_seed = seed
        self.engine = QueueSimulationEngine(base_seed=seed)

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
        """
        return self.engine.simulate_strategy(
            strategy=strategy,
            arrival_rate_per_hour=arrival_rate,
            num_counters=num_counters,
            avg_service_time_minutes=avg_service_minutes,
            service_time_std_minutes=service_std,
            duration_minutes=duration_minutes,
            seed=seed,
        )

    def run_comparative_experiment(
        self,
        strategies: List[str] = None,
        num_runs: int = 3,
        arrival_rate: float = 30.0,
        num_counters: int = 3,
        avg_service_minutes: float = 8.0,
        service_std: float = 2.0,
        duration_minutes: int = 480,
    ) -> Dict[str, Any]:
        """Run repeated Monte Carlo trials for statistical comparative analysis."""
        return self.engine.run_comparative_experiment(
            strategies=strategies,
            num_runs=num_runs,
            arrival_rate_per_hour=arrival_rate,
            num_counters=num_counters,
            avg_service_time_minutes=avg_service_minutes,
            service_time_std_minutes=service_std,
            duration_minutes=duration_minutes,
        )
