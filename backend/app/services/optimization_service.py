"""
Optimization Service — Counter and staff allocation optimizer using Google OR-Tools MIP solver.

Minimizes a weighted objective function of:
  - Expected waiting time (via Erlang C queueing formulation)
  - Counter activation cost
  - Staff reassignment cost
  - Capacity shortfall / underutilization penalty

Subject to:
  - Available staff constraints
  - Staff skill compatibility
  - Physical counter capacity
  - Minimum staffing requirements
"""
import sys
import os
import math
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.operational import Department, Counter, Staff, StaffSkill
from app.models.queue import QueueObservation
from app.services.forecasting_service import ForecastingService

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from ml.optimization.solver import CounterAllocationOptimizer
from ml.optimization.queue_theory import mmc_expected_waiting_time


class OptimizationService:
    def __init__(self, session: Session):
        self.session = session

    def optimize(
        self,
        dept_id: int,
        horizon_minutes: int = 60,
        weight_wait: float = 0.5,
        weight_cost: float = 0.3,
        weight_utilization: float = 0.2,
    ) -> Dict[str, Any]:
        # ─── 1. Gather department and counter state ─────────────────────────
        dept = self.session.get(Department, dept_id)
        dept_name = dept.name if dept else f"Department {dept_id}"

        counters = self.session.execute(
            select(Counter).where(Counter.department_id == dept_id, Counter.is_active == True)
        ).scalars().all()
        total_counters = len(counters)
        current_open = sum(1 for c in counters if c.status == "open")

        # ─── 2. Gather available staff with skills ──────────────────────────
        staff_objs = self.session.execute(
            select(Staff).where(Staff.is_available == True, Staff.is_active == True)
        ).scalars().all()

        staff_data: List[Dict[str, Any]] = []
        for s in staff_objs:
            # Query staff skills
            skills = [sk.department_id for sk in s.skills] if s.skills else []
            if s.department_id and s.department_id not in skills:
                skills.append(s.department_id)
            staff_data.append({
                "id": s.id,
                "name": s.full_name,
                "skills": skills,
            })

        # ─── 3. Recent service times and arrival rate ───────────────────────
        now = datetime.now(timezone.utc)
        recent_obs = self.session.execute(
            select(QueueObservation)
            .where(
                QueueObservation.department_id == dept_id,
                QueueObservation.timestamp >= now - timedelta(hours=2),
            )
            .order_by(QueueObservation.timestamp.desc())
            .limit(8)
        ).scalars().all()

        if recent_obs:
            avg_service_sec = float(
                np.mean([o.avg_service_time_seconds for o in recent_obs if o.avg_service_time_seconds])
                or 300.0
            )
            recent_arrivals = float(np.mean([o.arrivals_in_interval for o in recent_obs]))
        else:
            avg_service_sec = 300.0
            recent_arrivals = 8.0

        # Forecast demand for the horizon
        try:
            svc = ForecastingService(self.session)
            forecast_pts = svc.predict(dept_id, "rf", horizon_minutes)
            forecast_demand = sum(p.predicted_arrivals for p in forecast_pts)
            hourly_rate = (forecast_demand / horizon_minutes) * 60.0
        except Exception:
            hourly_rate = recent_arrivals * 4.0  # 4 x 15-min intervals per hour
            forecast_demand = hourly_rate * (horizon_minutes / 60.0)

        # ─── 4. Run OR-Tools MIP Optimizer ─────────────────────────────────
        optimizer = CounterAllocationOptimizer(
            weight_wait=weight_wait,
            weight_cost=weight_cost,
            weight_utilization=weight_utilization,
            weight_reassignment=0.10,
        )

        result = optimizer.solve(
            dept_id=dept_id,
            department_name=dept_name,
            total_counters=total_counters,
            currently_open_counters=current_open,
            available_staff=staff_data,
            predicted_arrivals_per_hour=max(hourly_rate, 4.0),
            avg_service_time_seconds=avg_service_sec,
            min_required_counters=1,
        )

        result["forecast_demand"] = forecast_demand
        return result
