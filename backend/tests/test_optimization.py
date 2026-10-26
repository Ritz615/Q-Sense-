"""
Automated unit tests: Queueing theory approximations and OR-Tools optimization.
"""
import pytest
from ml.optimization.queue_theory import mmc_expected_waiting_time, mmc_system_metrics
from ml.optimization.solver import CounterAllocationOptimizer


def test_mmc_expected_waiting_time():
    # lambda = 0.05/sec, mu = 0.03/sec, c = 2 servers (stable system: rho = 0.05/(2*0.03) = 0.833)
    wait = mmc_expected_waiting_time(0.05, 0.03, 2)
    assert wait > 0.0
    assert wait < 1000.0

    # Over-saturated system (lambda >= c * mu)
    unstable_wait = mmc_expected_waiting_time(0.10, 0.03, 2)
    assert unstable_wait == float("inf")


def test_counter_allocation_optimizer():
    optimizer = CounterAllocationOptimizer()
    staff = [
        {"id": 1, "name": "Staff A", "skills": [1, 2]},
        {"id": 2, "name": "Staff B", "skills": [1]},
        {"id": 3, "name": "Staff C", "skills": [2]},  # unqualified for dept 1
        {"id": 4, "name": "Staff D", "skills": [1]},
    ]

    res = optimizer.solve(
        dept_id=1,
        department_name="Certificate Services",
        total_counters=5,
        currently_open_counters=2,
        available_staff=staff,
        predicted_arrivals_per_hour=30.0,
        avg_service_time_seconds=300.0,
        min_required_counters=1,
    )

    assert res["solver_status"] == "optimal"
    assert res["recommended_counters"] >= 1
    # Only 3 staff qualified for dept 1 (A, B, D)
    assert res["recommended_counters"] <= 3
    assert len(res["assignment_plan"]) == res["recommended_counters"]
    # Check that Staff C was never assigned to Dept 1
    assigned_staff_ids = [plan["staff_id"] for plan in res["assignment_plan"].values()]
    assert 3 not in assigned_staff_ids


def test_optimizer_infeasibility_handling():
    optimizer = CounterAllocationOptimizer()
    # No staff available for dept 1
    staff = [{"id": 5, "name": "Staff E", "skills": [2]}]

    res = optimizer.solve(
        dept_id=1,
        department_name="Certificate Services",
        total_counters=5,
        currently_open_counters=2,
        available_staff=staff,
        predicted_arrivals_per_hour=30.0,
        avg_service_time_seconds=300.0,
        min_required_counters=1,
    )
    assert res["solver_status"] == "infeasible"
    assert "Infeasible" in res["conflict_reason"]
