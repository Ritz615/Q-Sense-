"""
Simulation API routes — queue simulation and what-if scenario comparison.
"""
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.analytics import SimulationRun, SimulationResult
from app.schemas.schemas import SimulationConfig, SimulationRunOut, SimulationResultOut

router = APIRouter(prefix="/simulation", tags=["Simulation"])

# Global live simulation state
_live_sim_state = {
    "running": False,
    "config": None,
    "task": None,
}


async def _run_whatif_simulation(run_id: int, config: dict, db_url: str):
    """Background task: run comparative simulation for all strategies."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.services.simulation_service import SimulationService

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        run = session.get(SimulationRun, run_id)
        if not run:
            return
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        session.commit()
        try:
            svc = SimulationService(seed=config.get("seed", 42))
            strategies = config.get("strategies", ["fixed", "rule_based", "optimization"])
            for strategy in strategies:
                for trial in range(config.get("num_runs", 3)):
                    result_data = svc.run_strategy(
                        strategy=strategy,
                        arrival_rate=config.get("arrival_rate_per_hour", 30),
                        num_counters=config.get("num_counters_fixed", 3),
                        avg_service_minutes=config.get("avg_service_time_minutes", 8),
                        service_std=config.get("service_time_std_minutes", 2),
                        duration_minutes=config.get("duration_minutes", 480),
                        seed=config.get("seed", 42) + trial,
                    )
                    sr = SimulationResult(
                        run_id=run_id,
                        strategy=result_data.get("strategy", strategy),
                        mean_wait_seconds=result_data["mean_wait_seconds"],
                        median_wait_seconds=result_data["median_wait_seconds"],
                        p90_wait_seconds=result_data["p90_wait_seconds"],
                        max_queue_length=result_data["max_queue_length"],
                        customers_served=result_data["customers_served"],
                        throughput_per_hour=result_data["throughput_per_hour"],
                        counter_utilization=result_data["counter_utilization"],
                        service_level_attained=result_data.get("service_level_attained"),
                        detailed_results=result_data.get("detailed_results"),
                    )
                    session.add(sr)
            session.commit()
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            session.commit()
        except Exception as e:
            run.status = "failed"
            session.commit()
            raise


@router.post("/runs", response_model=SimulationRunOut, status_code=201)
async def create_simulation_run(
    payload: SimulationConfig,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.core.config import settings

    run = SimulationRun(
        name=payload.name,
        department_id=payload.department_id,
        config=payload.model_dump(),
        seed=payload.seed,
        duration_minutes=payload.duration_minutes,
        status="pending",
        created_by=current_user.id,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    background_tasks.add_task(
        _run_whatif_simulation,
        run.id,
        payload.model_dump(),
        settings.DATABASE_SYNC_URL,
    )
    return run


@router.get("/runs", response_model=List[SimulationRunOut])
async def list_runs(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SimulationRun).order_by(desc(SimulationRun.created_at)).limit(limit)
    )
    return result.scalars().all()


@router.get("/runs/{run_id}/results", response_model=List[SimulationResultOut])
async def get_run_results(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SimulationResult).where(SimulationResult.run_id == run_id)
    )
    return result.scalars().all()


@router.post("/live/start")
async def start_live_simulation(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the live queue simulation that populates real-time observations."""
    from app.services.live_simulation_service import LiveSimulationService

    if _live_sim_state["running"]:
        return {"message": "Simulation already running", "status": "running"}

    _live_sim_state["running"] = True

    async def live_sim_task():
        from app.core.config import settings
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        engine = create_engine(settings.DATABASE_SYNC_URL)
        Session = sessionmaker(bind=engine)
        svc = LiveSimulationService()
        try:
            while _live_sim_state["running"]:
                with Session() as session:
                    svc.step(session)
                    session.commit()
                await asyncio.sleep(15)  # generate new observation every 15s
        except asyncio.CancelledError:
            pass
        finally:
            _live_sim_state["running"] = False

    task = asyncio.ensure_future(live_sim_task())
    _live_sim_state["task"] = task
    return {"message": "Live simulation started", "status": "running"}


@router.post("/live/stop")
async def stop_live_simulation(current_user: User = Depends(get_current_user)):
    _live_sim_state["running"] = False
    if _live_sim_state.get("task"):
        _live_sim_state["task"].cancel()
        _live_sim_state["task"] = None
    return {"message": "Live simulation stopped", "status": "stopped"}


@router.get("/live/status")
async def live_simulation_status(current_user: User = Depends(get_current_user)):
    return {"running": _live_sim_state["running"]}
