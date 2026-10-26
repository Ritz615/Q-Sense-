"""
Automated unit tests: Discrete-event queue simulation and strategy comparison.
"""
import pytest
from ml.simulation.engine import QueueSimulationEngine


def test_simulation_reproducibility():
    engine = QueueSimulationEngine(base_seed=42)

    run1 = engine.simulate_strategy("fixed", arrival_rate_per_hour=30.0, num_counters=3, seed=42)
    run2 = engine.simulate_strategy("fixed", arrival_rate_per_hour=30.0, num_counters=3, seed=42)

    assert run1["mean_wait_seconds"] == run2["mean_wait_seconds"]
    assert run1["customers_served"] == run2["customers_served"]
    assert run1["max_queue_length"] == run2["max_queue_length"]


def test_strategy_metrics_returned():
    engine = QueueSimulationEngine()

    for strat in ["fixed", "rule_based", "optimization"]:
        res = engine.simulate_strategy(
            strategy=strat,
            arrival_rate_per_hour=25.0,
            num_counters=3,
            avg_service_time_minutes=6.0,
            duration_minutes=120,
            seed=123,
        )
        assert res["strategy"] == strat
        assert res["mean_wait_seconds"] >= 0.0
        assert res["customers_served"] >= 0
        assert 0.0 <= res["counter_utilization"] <= 1.0


def test_comparative_experiment():
    engine = QueueSimulationEngine(base_seed=10)
    summary = engine.run_comparative_experiment(
        strategies=["fixed", "rule_based"],
        num_runs=3,
        duration_minutes=120,
    )
    assert "fixed" in summary
    assert "rule_based" in summary
    assert summary["fixed"]["num_trials"] == 3
    assert len(summary["fixed"]["individual_runs"]) == 3


def test_whatif_simulation_worker(tmp_path):
    import asyncio
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.api.simulation import _run_whatif_simulation
    from app.models.analytics import SimulationRun, SimulationResult
    from app.database.session import Base

    db_file = tmp_path / "test_sim.db"
    db_url = f"sqlite:///{db_file}"
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    with Session() as s:
        run = SimulationRun(
            name="Worker Test",
            config={},
            status="pending",
        )
        s.add(run)
        s.commit()
        run_id = run.id

    payload = {
        "name": "Worker Test",
        "arrival_rate_per_hour": 20.0,
        "num_counters_fixed": 2,
        "avg_service_time_minutes": 5.0,
        "duration_minutes": 60,
        "seed": 99,
        "strategies": ["fixed", "rule_based"],
        "num_runs": 1,
    }

    asyncio.run(_run_whatif_simulation(run_id, payload, db_url))

    with Session() as s:
        updated_run = s.get(SimulationRun, run_id)
        assert updated_run.status == "completed"
        results = s.query(SimulationResult).filter_by(run_id=run_id).all()
        assert len(results) == 2
        assert {r.strategy for r in results} == {"fixed", "rule_based"}
        for r in results:
            assert r.mean_wait_seconds >= 0.0
            assert r.customers_served >= 0
            assert 0.0 <= r.counter_utilization <= 1.0


