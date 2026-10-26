"""
Q-Sense FastAPI Application Entry Point.

Registers all routers, sets up CORS, and initializes the database on startup.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Seed initial data if not present
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        engine = create_engine(settings.DATABASE_SYNC_URL)
        from app.database.seed import seed
        seed(engine)
    except Exception as e:
        print(f"Seed skipped or failed: {e}")

    # Ensure ML model directory exists
    os.makedirs(settings.MODEL_DIR, exist_ok=True)
    os.makedirs(settings.DATASETS_DIR, exist_ok=True)

    yield
    # Shutdown (nothing to clean up for SQLite)


app = FastAPI(
    title="Q-Sense API",
    description=(
        "Q-Sense: Intelligent Queue Management System for Government Offices. "
        "Provides REST endpoints for queue monitoring, forecasting, optimization, and simulation. "
        "All demonstration data is synthetic and not from real government operations."
    ),
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register Routers ────────────────────────────────────────────────────────

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.operations import router as ops_router
from app.api.users import router as users_router
from app.api.forecasting import router as forecasting_router
from app.api.optimization import router as optimization_router
from app.api.simulation import router as simulation_router
from app.api.analytics import router as analytics_router
from app.api.data_import import router as data_router
from app.api.explainability import router as explain_router
from app.api.camera import router as camera_router

PREFIX = "/api/v1"

app.include_router(auth_router, prefix=PREFIX)
app.include_router(dashboard_router, prefix=PREFIX)
app.include_router(ops_router, prefix=PREFIX)
app.include_router(users_router, prefix=PREFIX)
app.include_router(forecasting_router, prefix=PREFIX)
app.include_router(optimization_router, prefix=PREFIX)
app.include_router(simulation_router, prefix=PREFIX)
app.include_router(analytics_router, prefix=PREFIX)
app.include_router(data_router, prefix=PREFIX)
app.include_router(explain_router, prefix=PREFIX)
app.include_router(camera_router, prefix=PREFIX)


@app.get("/")
async def root():
    return {
        "app": "Q-Sense",
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "status": "running",
        "note": "All demonstration data is synthetic.",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
