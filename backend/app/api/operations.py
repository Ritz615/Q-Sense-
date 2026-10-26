"""
Department and Counter management API routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.operational import Department, Counter, Staff, StaffSkill
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.schemas import (
    DepartmentCreate, DepartmentUpdate, DepartmentOut,
    CounterCreate, CounterUpdate, CounterOut,
    StaffCreate, StaffUpdate, StaffOut,
)

router = APIRouter(tags=["Operations"])


# ─── Departments ─────────────────────────────────────────────────────────────

dept_router = APIRouter(prefix="/departments")


@dept_router.get("", response_model=List[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()


@dept_router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(dept_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@dept_router.post("", response_model=DepartmentOut, status_code=201)
async def create_department(payload: DepartmentCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    dept = Department(**payload.model_dump())
    db.add(dept)
    await db.flush()
    await db.refresh(dept)
    return dept


@dept_router.patch("/{dept_id}", response_model=DepartmentOut)
async def update_department(dept_id: int, payload: DepartmentUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dept, k, v)
    await db.flush()
    await db.refresh(dept)
    return dept


# ─── Counters ────────────────────────────────────────────────────────────────

counter_router = APIRouter(prefix="/counters")


@counter_router.get("", response_model=List[CounterOut])
async def list_counters(
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Counter)
    if department_id:
        q = q.where(Counter.department_id == department_id)
    result = await db.execute(q.order_by(Counter.number))
    return result.scalars().all()


@counter_router.get("/{counter_id}", response_model=CounterOut)
async def get_counter(counter_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Counter).where(Counter.id == counter_id))
    counter = result.scalar_one_or_none()
    if not counter:
        raise HTTPException(status_code=404, detail="Counter not found")
    return counter


@counter_router.post("", response_model=CounterOut, status_code=201)
async def create_counter(payload: CounterCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    counter = Counter(**payload.model_dump())
    db.add(counter)
    await db.flush()
    await db.refresh(counter)
    return counter


@counter_router.patch("/{counter_id}", response_model=CounterOut)
async def update_counter(counter_id: int, payload: CounterUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Counter).where(Counter.id == counter_id))
    counter = result.scalar_one_or_none()
    if not counter:
        raise HTTPException(status_code=404, detail="Counter not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(counter, k, v)
    await db.flush()
    await db.refresh(counter)
    return counter


# ─── Staff ───────────────────────────────────────────────────────────────────

staff_router = APIRouter(prefix="/staff")


@staff_router.get("", response_model=List[StaffOut])
async def list_staff(
    department_id: Optional[int] = Query(None),
    available_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Staff).where(Staff.is_active == True)
    if department_id:
        q = q.where(Staff.department_id == department_id)
    if available_only:
        q = q.where(Staff.is_available == True)
    result = await db.execute(q.order_by(Staff.full_name))
    return result.scalars().all()


@staff_router.get("/{staff_id}", response_model=StaffOut)
async def get_staff_member(staff_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Staff).where(Staff.id == staff_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return s


@staff_router.post("", response_model=StaffOut, status_code=201)
async def create_staff(payload: StaffCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    s = Staff(**payload.model_dump())
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return s


@staff_router.patch("/{staff_id}", response_model=StaffOut)
async def update_staff(staff_id: int, payload: StaffUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(Staff).where(Staff.id == staff_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Staff member not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.flush()
    await db.refresh(s)
    return s


router.include_router(dept_router)
router.include_router(counter_router)
router.include_router(staff_router)
