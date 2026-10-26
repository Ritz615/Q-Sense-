"""
Synthetic data seed script for Q-Sense demonstration.
Generates departments, counters, staff, and historical queue observations.
All data is clearly labeled as synthetic/simulation.
Run: python -m app.database.seed
"""
import random
import math
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.operational import Department, ServiceType, Counter, Staff, StaffSkill
from app.models.queue import QueueObservation, QueueEvent, QueueTicket
from app.database.session import Base


DEPARTMENTS = [
    {"name": "Certificate & Document Services", "code": "CDS", "description": "Birth certificates, academic records, attestation", "max_counters": 8},
    {"name": "Revenue & Tax Services", "code": "RTS", "description": "Property tax, utility bills, revenue certificates", "max_counters": 6},
    {"name": "Identity & Application Verification", "code": "IAV", "description": "ID verification, application processing", "max_counters": 10},
    {"name": "General Citizen Support", "code": "GCS", "description": "General enquiries, grievance registration", "max_counters": 5},
]

SERVICE_TYPES = [
    (1, "Birth Certificate", "BC", 300),
    (1, "Academic Attestation", "AA", 420),
    (1, "Document Apostille", "DA", 600),
    (2, "Property Tax Payment", "PTP", 240),
    (2, "Revenue Certificate", "RC", 360),
    (3, "ID Verification", "IDV", 180),
    (3, "Application Submission", "AS", 480),
    (4, "Grievance Registration", "GR", 150),
    (4, "General Enquiry", "GE", 120),
]

STAFF_NAMES = [
    "Amit Kumar", "Priya Sharma", "Rahul Singh", "Sunita Patel", "Vijay Mehta",
    "Anjali Gupta", "Deepak Verma", "Rekha Nair", "Suresh Reddy", "Meena Joshi",
    "Arun Pillai", "Kavitha Rao", "Manoj Tiwari", "Lakshmi Devi", "Rajesh Mishra",
    "Pooja Agarwal", "Sanjay Pandey", "Usha Krishnan", "Rakesh Yadav", "Shweta Das",
]


def seed(engine):
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        # ─── Check if already seeded ──────────────────────────────────
        existing = session.query(User).count()
        if existing > 0:
            print("Database already seeded. Skipping.")
            return

        random.seed(42)
        print("Seeding Q-Sense demonstration database...")

        # ─── Users ────────────────────────────────────────────────────
        admin = User(
            username="admin",
            email="admin@qsense.demo",
            hashed_password=get_password_hash("QSense@Admin2024"),
            full_name="System Administrator",
            role="admin",
            is_active=True,
        )
        operator = User(
            username="operator",
            email="operator@qsense.demo",
            hashed_password=get_password_hash("Operator@2024"),
            full_name="Counter Operator",
            role="operator",
            is_active=True,
        )
        session.add_all([admin, operator])
        session.flush()
        print("  ✓ Users created (admin / operator)")

        # ─── Departments ──────────────────────────────────────────────
        depts = []
        for d in DEPARTMENTS:
            dept = Department(**d)
            session.add(dept)
            session.flush()
            depts.append(dept)
        print(f"  ✓ {len(depts)} departments created")

        # ─── Service Types ────────────────────────────────────────────
        for dept_idx, name, code, avg_time in SERVICE_TYPES:
            stype = ServiceType(
                department_id=depts[dept_idx - 1].id,
                name=name,
                code=code,
                avg_service_time_seconds=avg_time,
            )
            session.add(stype)
        print(f"  ✓ {len(SERVICE_TYPES)} service types created")

        # ─── Counters ─────────────────────────────────────────────────
        counter_count = 0
        for dept in depts:
            n_counters = min(dept.max_counters, random.randint(4, 8))
            for i in range(1, n_counters + 1):
                status = "open" if i <= random.randint(2, n_counters - 1) else "closed"
                counter = Counter(
                    department_id=dept.id,
                    name=f"Counter {i}",
                    number=i,
                    status=status,
                    is_active=True,
                )
                session.add(counter)
                counter_count += 1
        print(f"  ✓ {counter_count} counters created")

        # ─── Staff ────────────────────────────────────────────────────
        staff_list = []
        for i, name in enumerate(STAFF_NAMES):
            dept_id = depts[i % len(depts)].id
            s = Staff(
                employee_id=f"EMP{1000+i:04d}",
                full_name=name,
                department_id=dept_id,
                is_available=random.choice([True, True, True, False]),
                shift_start="09:00",
                shift_end="17:00",
            )
            session.add(s)
            session.flush()
            # Add skills
            for d in depts:
                if d.id == dept_id or random.random() < 0.3:
                    skill = StaffSkill(staff_id=s.id, department_id=d.id, proficiency="trained")
                    session.add(skill)
            staff_list.append(s)
        print(f"  ✓ {len(staff_list)} staff members created")

        # ─── Historical Queue Observations (90 days) ──────────────────
        obs_count = 0
        ticket_count = 0
        now = datetime.now(timezone.utc)

        def arrival_rate(hour: int, dept_id: int) -> float:
            base = {8: 4, 9: 12, 10: 15, 11: 13, 12: 6, 13: 5, 14: 14, 15: 16, 16: 12, 17: 5}.get(hour, 2)
            dept_factors = {depts[0].id: 1.0, depts[1].id: 0.8, depts[2].id: 1.2, depts[3].id: 0.6}
            return max(0, base * dept_factors.get(dept_id, 1.0) * random.gauss(1.0, 0.15))

        for day_offset in range(90):
            day = now - timedelta(days=90 - day_offset)
            is_weekday = day.weekday() < 5

            if not is_weekday:
                continue  # No observations on weekends

            for dept in depts:
                queue_len = 0
                for hour in range(8, 18):
                    for interval in range(4):  # 4 x 15-min intervals
                        ts = day.replace(hour=hour, minute=interval * 15, second=0, microsecond=0)

                        arrivals = int(arrival_rate(hour, dept.id))
                        active_counters = random.randint(2, min(dept.max_counters, 5))
                        avg_svc = random.gauss(300, 50)
                        capacity = active_counters * (15 * 60 / max(avg_svc, 60))
                        completions = min(int(capacity * random.gauss(1.0, 0.1)), queue_len + arrivals)
                        queue_len = max(0, queue_len + arrivals - completions)

                        lam = max(arrivals / (15 * 60), 0.001)
                        wait_sec = queue_len / (lam * active_counters) if active_counters > 0 else queue_len * avg_svc
                        wait_sec = max(0, min(wait_sec, 3600))

                        obs = QueueObservation(
                            department_id=dept.id,
                            timestamp=ts,
                            people_waiting=queue_len,
                            active_counters=active_counters,
                            arrivals_in_interval=arrivals,
                            completed_services=completions,
                            avg_service_time_seconds=round(avg_svc, 1),
                            observed_waiting_time_seconds=round(wait_sec, 1),
                            source="simulation",
                            interval_minutes=15,
                        )
                        session.add(obs)
                        obs_count += 1

            if obs_count % 5000 == 0:
                session.flush()

        session.flush()
        print(f"  ✓ {obs_count} historical observations generated (90 days)")

        session.commit()
        print("\n✅ Seeding complete!")
        print("   Admin login: username=admin  password=QSense@Admin2024")
        print("   Operator login: username=operator  password=Operator@2024")
        print("   ⚠  All data is synthetic — not real government data.")


if __name__ == "__main__":
    engine = create_engine(settings.DATABASE_SYNC_URL)
    seed(engine)
