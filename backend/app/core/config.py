"""
Q-Sense Application Configuration
Environment-based settings management using pydantic-settings.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Q-Sense"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "qsense-dev-secret-key-change-in-production-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./qsense.db"
    DATABASE_SYNC_URL: str = "sqlite:///./qsense.db"

    # PostgreSQL (production)
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_HOST: Optional[str] = None
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: Optional[str] = None

    # CORS
    ALLOWED_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # Upload
    MAX_UPLOAD_SIZE_MB: int = 50

    # ML
    MODEL_DIR: str = "./ml/models"
    DATASETS_DIR: str = "./ml/data/datasets"

    # Simulation
    SIM_DEFAULT_SEED: int = 42

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
