"""
Live Simulation Service — generates synthetic queue observations in real time.
Simulates government office queue dynamics with peak hour patterns.
All data is clearly labeled as 'simulation' source.
"""
import random
import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.operational import Department, Counter
from app.models.queue import QueueObservation, QueueEvent


class LiveSimulationService:
    """Generates one step of synthetic queue observations per call."""

    def __init__(self, seed: int = 42):
        random.seed(seed)
        self._queue_state: dict = {}  # dept_id -> current queue length

    def _arrival_rate(self, hour: int, dept_id: int) -> float:
        """Return approximate arrivals per 15-minute interval for given hour."""
        # Peak hours: 9-11am and 2-4pm, lower during lunch
        base_rates = {
            8: 4, 9: 12, 10: 15, 11: 13, 12: 6, 13: 5,
            14: 14, 15: 16, 16: 12, 17: 5, 18: 2,
        }
        base = base_rates.get(hour, 3)
        # Department variation
        dept_factor = {1: 1.0, 2: 0.8, 3: 1.2, 4: 0.6}.get(dept_id, 1.0)
        jitter = random.gauss(1.0, 0.15)
        return max(0.0, base * dept_factor * jitter)

    def _service_time(self, dept_id: int) -> float:
        """Simulate average service time in seconds."""
        base_times = {1: 280, 2: 360, 3: 420, 4: 240}
        base = base_times.get(dept_id, 300)
        return max(60.0, random.gauss(base, base * 0.15))

    def step(self, session: Session) -> None:
        """Generate one observation per active department."""
        now = datetime.now(timezone.utc)
        hour = now.hour

        # Get all active departments
        departments = session.execute(
            select(Department).where(Department.is_active == True)
        ).scalars().all()

        for dept in departments:
            dept_id = dept.id

            # Current open counters for this dept
            counters = session.execute(
                select(Counter).where(
                    Counter.department_id == dept_id,
                    Counter.is_active == True,
                    Counter.status == "open",
                )
            ).scalars().all()
            active_counters = len(counters)

            # Fallback: at least 1 counter open during business hours
            if active_counters == 0 and 8 <= hour <= 17:
                active_counters = 2

            arrivals = int(random.gauss(self._arrival_rate(hour, dept_id), 1.5))
            arrivals = max(0, arrivals)

            prev_queue = self._queue_state.get(dept_id, 0)
            service_time = self._service_time(dept_id)
            capacity_per_interval = active_counters * (15 * 60 / service_time)  # people served per 15 min
            completions = min(int(capacity_per_interval * random.gauss(1.0, 0.1)), prev_queue + arrivals)
            completions = max(0, completions)

            new_queue = max(0, prev_queue + arrivals - completions)
            # Simulate occasional outage
            if random.random() < 0.02:  # 2% chance of counter issue
                new_queue = int(new_queue * 1.3)

            self._queue_state[dept_id] = new_queue

            # Estimate waiting time using Little's Law: W = L/lambda
            lam = max(arrivals / (15 * 60), 0.001)
            wait_sec = new_queue / (lam * active_counters) if active_counters > 0 else new_queue * service_time
            wait_sec = min(wait_sec, 3600)  # cap at 1 hour

            obs = QueueObservation(
                department_id=dept_id,
                timestamp=now,
                people_waiting=new_queue,
                active_counters=active_counters,
                arrivals_in_interval=arrivals,
                completed_services=completions,
                avg_service_time_seconds=service_time,
                observed_waiting_time_seconds=wait_sec,
                source="simulation",
                interval_minutes=15,
            )
            session.add(obs)

            # Queue event for arrivals
            if arrivals > 0:
                event = QueueEvent(
                    department_id=dept_id,
                    event_type="arrival_batch",
                    timestamp=now,
                    payload={"count": arrivals, "queue_after": new_queue},
                    source="simulation",
                )
                session.add(event)
