"""
Train and Evaluate All Forecasting Models on Historical Queue Data,
and Generate Pre-Populated Allocation Recommendations.
Usage: python scripts/train_models.py
"""
import sys
import os
import json
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from app.core.config import settings
from app.database.session import Base
from app.models.analytics import ModelVersion, AllocationRecommendation
from app.services.forecasting_service import ForecastingService
from app.services.optimization_service import OptimizationService


def main():
    print("=" * 65)
    print("  Q-Sense Model Training & Decision Optimization Pipeline")
    print("=" * 65)

    engine = create_engine(settings.DATABASE_SYNC_URL)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    models_to_train = ["baseline", "ma", "rf", "gb", "lstm", "tcn"]
    departments_to_train = [1, 2, 3, 4]

    summary = {}

    with Session() as session:
        # Clear existing models if re-running
        session.query(ModelVersion).delete()
        session.query(AllocationRecommendation).delete()
        session.commit()

        svc = ForecastingService(session)

        for dept_id in departments_to_train:
            print(f"\n--- Department {dept_id} ---")
            dept_summary = {}

            for m_type in models_to_train:
                print(f"  Training model: {m_type.upper():<10}...", end=" ", flush=True)
                try:
                    version_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                    model_dir = os.path.join(settings.MODEL_DIR, f"dept_{dept_id}", m_type)
                    os.makedirs(model_dir, exist_ok=True)
                    file_path = os.path.join(model_dir, f"model_{version_str}.pkl")

                    mv = ModelVersion(
                        name=f"{m_type.upper()} - Dept {dept_id}",
                        model_type=m_type,
                        department_id=dept_id,
                        version=version_str,
                        file_path=file_path,
                        status="training",
                    )
                    session.add(mv)
                    session.flush()

                    metrics = svc.train(dept_id, m_type, mv.id)
                    mv.status = "ready"
                    mv.metrics = metrics
                    mv.trained_at = datetime.now(timezone.utc)
                    session.commit()

                    dept_summary[m_type] = {
                        "mae": metrics.get("mae"),
                        "rmse": metrics.get("rmse"),
                        "smape": metrics.get("smape"),
                        "status": "ready",
                    }
                    print(f"DONE | MAE: {metrics.get('mae', 0):.2f} | RMSE: {metrics.get('rmse', 0):.2f} | sMAPE: {metrics.get('smape', 0):.1f}%")
                except Exception as e:
                    session.rollback()
                    dept_summary[m_type] = {"status": "failed", "error": str(e)}
                    print(f"FAILED: {e}")

            summary[f"dept_{dept_id}"] = dept_summary

        # ─── Generate Pre-Populated Optimization Recommendations ─────
        print("\n--- Generating Optimization Recommendations ---")
        opt_svc = OptimizationService(session)
        for dept_id in departments_to_train:
            try:
                res = opt_svc.optimize(dept_id=dept_id, horizon_minutes=60)
                rec = AllocationRecommendation(
                    department_id=dept_id,
                    generated_at=datetime.now(timezone.utc),
                    recommended_counters=res["recommended_counters"],
                    current_counters=res["current_counters"],
                    forecast_demand=res.get("forecast_demand"),
                    expected_wait_before=res.get("expected_wait_before"),
                    expected_wait_after=res.get("expected_wait_after"),
                    utilization_before=res.get("utilization_before"),
                    utilization_after=res.get("utilization_after"),
                    assignment_plan=res.get("assignment_plan"),
                    objective_value=res.get("objective_value"),
                    solver_status=res.get("solver_status"),
                    explanation=res.get("explanation"),
                    status="pending",
                )
                session.add(rec)
                print(f"  [OK] Generated Recommendation for Dept {dept_id}: {res['current_counters']} -> {res['recommended_counters']} counters ({res['solver_status']})")
            except Exception as e:
                print(f"  [WARN] Optimization for Dept {dept_id} failed: {e}")

        session.commit()

    out_json = os.path.join(workspace_root, "research", "training_summary.json")
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 65)
    print(f"Training and optimization complete! Summary saved to {out_json}")
    print("=" * 65)


if __name__ == "__main__":
    main()
