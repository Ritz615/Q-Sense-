"""
Department, ServiceType, Counter, Staff, and related operational models.
"""
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    max_counters: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    service_types = relationship("ServiceType", back_populates="department", lazy="select")
    counters = relationship("Counter", back_populates="department", lazy="select")
    queue_observations = relationship("QueueObservation", back_populates="department", lazy="dynamic")


class ServiceType(Base):
    __tablename__ = "service_types"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    avg_service_time_seconds: Mapped[float] = mapped_column(Float, default=300.0)
    requires_specialist: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    department = relationship("Department", back_populates="service_types")


class Counter(Base):
    __tablename__ = "counters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="closed")  # open, closed, busy, maintenance
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    opening_time: Mapped[Optional[str]] = mapped_column(String(8), default="09:00")
    closing_time: Mapped[Optional[str]] = mapped_column(String(8), default="17:00")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    department = relationship("Department", back_populates="counters")
    staff_assignments = relationship("StaffAssignment", back_populates="counter", lazy="dynamic")


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    employee_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    shift_start: Mapped[str] = mapped_column(String(8), default="09:00")
    shift_end: Mapped[str] = mapped_column(String(8), default="17:00")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    skills = relationship("StaffSkill", back_populates="staff", lazy="select")
    assignments = relationship("StaffAssignment", back_populates="staff", lazy="dynamic")


class StaffSkill(Base):
    __tablename__ = "staff_skills"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    proficiency: Mapped[str] = mapped_column(String(32), default="trained")

    staff = relationship("Staff", back_populates="skills")


class StaffAssignment(Base):
    __tablename__ = "staff_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    counter_id: Mapped[int] = mapped_column(ForeignKey("counters.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)

    staff = relationship("Staff", back_populates="assignments")
    counter = relationship("Counter", back_populates="staff_assignments")
