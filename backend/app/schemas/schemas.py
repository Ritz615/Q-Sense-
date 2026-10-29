"""
Pydantic schemas for all API request/response models.
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, field_validator


# ─── Auth ────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str
    full_name: str


class LoginRequest(BaseModel):
    username: str
    password: str


# ─── Users ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str = "operator"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("admin", "operator"):
            raise ValueError("role must be admin or operator")
        return v


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Departments ─────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    max_counters: int = 10


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    max_counters: Optional[int] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool
    max_counters: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Counters ────────────────────────────────────────────────────────────────

class CounterCreate(BaseModel):
    department_id: int
    name: str
    number: int
    opening_time: str = "09:00"
    closing_time: str = "17:00"


class CounterUpdate(BaseModel):
    status: Optional[str] = None
    is_active: Optional[bool] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None


class CounterOut(BaseModel):
    id: int
    department_id: int
    name: str
    number: int
    status: str
    is_active: bool
    opening_time: Optional[str]
    closing_time: Optional[str]

    class Config:
        from_attributes = True


# ─── Staff ───────────────────────────────────────────────────────────────────

class StaffCreate(BaseModel):
    employee_id: str
    full_name: str
    department_id: Optional[int] = None
    shift_start: str = "09:00"
    shift_end: str = "17:00"


class StaffUpdate(BaseModel):
    is_available: Optional[bool] = None
    department_id: Optional[int] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    is_active: Optional[bool] = None


class StaffOut(BaseModel):
    id: int
    employee_id: str
    full_name: str
    department_id: Optional[int]
    is_available: bool
    is_active: bool
    shift_start: str
    shift_end: str

    class Config:
        from_attributes = True


# ─── Queue Observations ──────────────────────────────────────────────────────

class QueueObservationOut(BaseModel):
    id: int
    department_id: int
    timestamp: datetime
    people_waiting: int
    active_counters: int
    arrivals_in_interval: int
    completed_services: int
    avg_service_time_seconds: Optional[float]
    observed_waiting_time_seconds: Optional[float]
    source: str
    interval_minutes: int

    class Config:
        from_attributes = True


# ─── Dashboard ───────────────────────────────────────────────────────────────

class QueueEventCreate(BaseModel):
    department_id: Optional[int] = None
    counter_id: Optional[int] = None
    event_type: str
    payload: Optional[dict] = None
    source: str = "operator_workstation"


class QueueEventOut(BaseModel):
    id: int
    department_id: Optional[int] = None
    counter_id: Optional[int] = None
    event_type: str
    timestamp: datetime
    payload: Optional[dict] = None
    source: str

    class Config:
        from_attributes = True


class DashboardMetrics(BaseModel):
    total_queue: int
    active_counters: int
    available_counters: int
    avg_waiting_time_minutes: float
    arrival_rate_per_hour: float
    service_rate_per_hour: float
    forecast_next_hour: int
    counter_utilization: float
    available_staff: int
    congestion_alerts: List[str]
    last_updated: datetime


# ─── Forecasting ─────────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    department_id: int
    horizon_minutes: int = 60
    model_type: str = "rf"  # baseline, ma, rf, lstm


class ForecastPoint(BaseModel):
    timestamp: datetime
    predicted_arrivals: float
    predicted_queue_length: float
    predicted_wait_minutes: float


class ForecastResponse(BaseModel):
    department_id: int
    model_type: str
    generated_at: datetime
    horizon_minutes: int
    predictions: List[ForecastPoint]
    model_metrics: Optional[dict] = None


class TrainRequest(BaseModel):
    department_id: int
    model_type: str = "rf"
    horizon_minutes: int = 60


class TrainResponse(BaseModel):
    model_version_id: int
    model_type: str
    department_id: int
    status: str
    metrics: Optional[dict] = None
    message: str


# ─── Optimization ────────────────────────────────────────────────────────────

class OptimizationRequest(BaseModel):
    department_id: int
    horizon_minutes: int = 60
    weight_wait: float = 0.5
    weight_cost: float = 0.3
    weight_utilization: float = 0.2


class OptimizationResponse(BaseModel):
    recommendation_id: int
    department_id: int
    current_counters: int
    recommended_counters: int
    forecast_demand: float
    expected_wait_before_minutes: float
    expected_wait_after_minutes: float
    utilization_before: float
    utilization_after: float
    solver_status: str
    objective_value: float
    explanation: str
    assignment_plan: Optional[dict] = None


class RecommendationReview(BaseModel):
    status: str  # approved, rejected
    notes: Optional[str] = None


class AllocationRecommendationOut(BaseModel):
    id: int
    department_id: int
    generated_at: datetime
    recommended_counters: int
    current_counters: int
    forecast_demand: Optional[float]
    expected_wait_before: Optional[float]
    expected_wait_after: Optional[float]
    explanation: Optional[str]
    status: str
    solver_status: Optional[str]

    class Config:
        from_attributes = True


# ─── Simulation ──────────────────────────────────────────────────────────────

class SimulationConfig(BaseModel):
    name: str
    department_id: Optional[int] = None
    arrival_rate_per_hour: float = 30.0
    num_counters_fixed: int = 3
    avg_service_time_minutes: float = 8.0
    service_time_std_minutes: float = 2.0
    duration_minutes: int = 480
    seed: int = 42
    strategies: List[str] = ["fixed", "rule_based", "optimization"]
    num_runs: int = 3


class SimulationRunOut(BaseModel):
    id: int
    name: str
    department_id: Optional[int]
    config: dict
    seed: int
    duration_minutes: int
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class SimulationResultOut(BaseModel):
    id: int
    run_id: int
    strategy: str
    mean_wait_seconds: float
    median_wait_seconds: float
    p90_wait_seconds: float
    max_queue_length: int
    customers_served: int
    throughput_per_hour: float
    counter_utilization: float
    service_level_attained: Optional[float]

    class Config:
        from_attributes = True


# ─── Analytics ───────────────────────────────────────────────────────────────

class AnalyticsQuery(BaseModel):
    department_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# ─── Audit ───────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    details: Optional[dict]
    ip_address: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


# ─── CSV Upload ──────────────────────────────────────────────────────────────

class ImportSummary(BaseModel):
    total_rows: int
    imported_rows: int
    rejected_rows: int
    warnings: List[str]
    errors: List[str]
    preview: Optional[List[dict]] = None


# ─── Camera ──────────────────────────────────────────────────────────────────

class CameraSourceCreate(BaseModel):
    department_id: int
    name: str
    stream_source: str = "synthetic"
    roi_normalized: Optional[List[float]] = [0.1, 0.35, 0.9, 0.95]


class CameraSourceUpdate(BaseModel):
    name: Optional[str] = None
    stream_source: Optional[str] = None
    roi_normalized: Optional[List[float]] = None
    is_active: Optional[bool] = None


class CameraSourceOut(BaseModel):
    id: int
    department_id: int
    name: str
    stream_source: str
    roi_normalized: Optional[List[float]]
    status: str
    is_active: bool
    last_occupancy: int
    last_seen_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CameraFrameResponse(BaseModel):
    camera_id: int
    department_id: int
    raw_occupancy: int
    smoothed_occupancy: float
    fps: float
    status: str
    roi: List[float]
    detections_count: int
    timestamp: datetime


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int
