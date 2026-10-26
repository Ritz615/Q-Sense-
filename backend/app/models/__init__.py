"""
Models package — imports all models so SQLAlchemy's metadata knows about them.
"""
from app.models.user import User
from app.models.operational import Department, ServiceType, Counter, Staff, StaffSkill, StaffAssignment
from app.models.queue import QueueObservation, QueueTicket, QueueEvent
from app.models.analytics import ModelVersion, ForecastResult, AllocationRecommendation, SimulationRun, SimulationResult, AuditLog

__all__ = [
    "User",
    "Department", "ServiceType", "Counter", "Staff", "StaffSkill", "StaffAssignment",
    "QueueObservation", "QueueTicket", "QueueEvent",
    "ModelVersion", "ForecastResult", "AllocationRecommendation",
    "SimulationRun", "SimulationResult", "AuditLog",
]
