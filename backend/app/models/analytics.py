"""
ML, Forecasting, Optimization, Simulation, and Audit models.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


class ModelVersion(Base):
    """Tracks trained ML model versions and their evaluation metrics."""
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_type: Mapped[str] = mapped_column(String(64), nullable=False)  # lstm, rf, baseline, etc.
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="training")  # training, ready, failed, deprecated
    trained_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ForecastResult(Base):
    """Stored forecast outputs from trained models."""
    __tablename__ = "forecast_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    model_version_id: Mapped[Optional[int]] = mapped_column(ForeignKey("model_versions.id"), nullable=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    forecast_horizon_minutes: Mapped[int] = mapped_column(Integer, default=60)
    predictions: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # list of {timestamp, predicted_arrivals, predicted_queue_length}
    model_type: Mapped[str] = mapped_column(String(64), nullable=False)
    input_features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class AllocationRecommendation(Base):
    """Counter and staff allocation recommendations from the optimizer."""
    __tablename__ = "allocation_recommendations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recommended_counters: Mapped[int] = mapped_column(Integer, nullable=False)
    current_counters: Mapped[int] = mapped_column(Integer, nullable=False)
    forecast_demand: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expected_wait_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expected_wait_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    utilization_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    utilization_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    assignment_plan: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    objective_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    solver_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, approved, rejected
    reviewed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class SimulationRun(Base):
    """Records of what-if simulation experiments."""
    __tablename__ = "simulation_runs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, default=42)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=480)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    results = relationship("SimulationResult", back_populates="run", lazy="select")


class SimulationResult(Base):
    """Aggregated results for a simulation run and strategy."""
    __tablename__ = "simulation_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("simulation_runs.id"), nullable=False)
    strategy: Mapped[str] = mapped_column(String(64), nullable=False)  # fixed, rule_based, optimization
    mean_wait_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    median_wait_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    p90_wait_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    max_queue_length: Mapped[int] = mapped_column(Integer, nullable=False)
    customers_served: Mapped[int] = mapped_column(Integer, nullable=False)
    throughput_per_hour: Mapped[float] = mapped_column(Float, nullable=False)
    counter_utilization: Mapped[float] = mapped_column(Float, nullable=False)
    service_level_attained: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detailed_results: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    run = relationship("SimulationRun", back_populates="results")


class AuditLog(Base):
    """Audit log for all significant administrative actions."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    user = relationship("User", back_populates="audit_logs")
