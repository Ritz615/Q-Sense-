"""
Database Seeding Script for Q-Sense.
Usage: python scripts/seed_data.py
"""
import sys
import os
from sqlalchemy import create_engine

# Ensure backend is in python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.config import settings
from app.database.seed import seed


def main():
    print(f"Connecting to database: {settings.DATABASE_SYNC_URL}")
    engine = create_engine(settings.DATABASE_SYNC_URL)
    seed(engine)


if __name__ == "__main__":
    main()
