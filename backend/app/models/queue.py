"""
Queue observation, event, and ticket models.
Tracks real-time and historical queue data from all sources.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


class QueueObservation(Base):
    """A timestamped snapshot of queue state for a department."""
    __tablename__ = "queue_observations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    people_waiting: Mapped[int] = mapped_column(Integer, default=0)
    active_counters: Mapped[int] = mapped_column(Integer, default=0)
    arrivals_in_interval: Mapped[int] = mapped_column(Integer, default=0)
    completed_services: Mapped[int] = mapped_column(Integer, default=0)
    avg_service_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    observed_waiting_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="simulation")  # simulation, camera, manual, imported
    interval_minutes: Mapped[int] = mapped_column(Integer, default=15)

    department = relationship("Department", back_populates="queue_observations")


class QueueTicket(Base):
    """Individual service ticket for tracking per-customer service events."""
    __tablename__ = "queue_tickets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ticket_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    service_type_id: Mapped[Optional[int]] = mapped_column(ForeignKey("service_types.id"), nullable=True)
    counter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("counters.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="waiting")  # waiting, serving, completed, abandoned, on_hold
    citizen_name: Mapped[Optional[str]] = mapped_column(String(128), default="Citizen")
    priority: Mapped[Optional[str]] = mapped_column(String(32), default="normal")  # normal, special, fast_track, vip
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    service_name: Mapped[Optional[str]] = mapped_column(String(128), default="Standard Service")
    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    service_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    service_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    waiting_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    service_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="simulation")


class QueueEvent(Base):
    """Low-level event log for queue state changes."""
    __tablename__ = "queue_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    counter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("counters.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)  # arrival, service_start, completion, counter_open, counter_close
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="simulation")


class CameraSource(Base):
    """Configured video camera or feed source for computer-vision queue occupancy monitoring."""
    __tablename__ = "camera_sources"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    stream_source: Mapped[str] = mapped_column(String(256), default="synthetic")  # 0, rtsp url, file path, synthetic
    roi_normalized: Mapped[Optional[list]] = mapped_column(JSON, default=lambda: [0.1, 0.35, 0.9, 0.95])
    status: Mapped[str] = mapped_column(String(32), default="synthetic")  # online, offline, degraded, synthetic
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_occupancy: Mapped[int] = mapped_column(Integer, default=0)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
