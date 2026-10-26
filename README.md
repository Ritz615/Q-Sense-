# Q-Sense — Intelligent Queue Management System

> **A Deep Learning and Optimization-Based Intelligent Decision Support System for Queue Prediction and Dynamic Resource Allocation in Government Offices**

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Backend
```bash
cd backend
pip install -r requirements.txt greenlet
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API docs at: **http://localhost:8000/api/docs**

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
App at: **http://localhost:5173**

### Demo Credentials
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `QSense@Admin2024` |
| Operator | `operator` | `Operator@2024` |

---

## 🏗️ Architecture

```
Q-Sense/
├── backend/                # FastAPI + SQLAlchemy backend
│   ├── app/
│   │   ├── api/            # REST endpoints (auth, dashboard, forecasting, optimization, simulation…)
│   │   ├── core/           # Config, security, JWT
│   │   ├── database/       # Async session, migrations, seed data
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   └── services/       # Business logic (ML, optimization, simulation)
│   └── requirements.txt
│
├── frontend/               # React + Vite + Tailwind CSS
│   └── src/
│       ├── pages/          # 15 full-feature pages
│       ├── components/     # Reusable UI components
│       ├── hooks/          # Auth context
│       ├── services/       # Axios API client
│       └── layouts/        # App shell + sidebar
│
├── docker-compose.yml      # PostgreSQL + Backend + Frontend
└── README.md
```

---

## 🧠 ML & Optimization Modules

| Module | Description |
|--------|-------------|
| **Baseline** | Time-of-day historical average (no training needed) |
| **Moving Average** | Exponential smoothing (α=0.3) |
| **Random Forest** | Ensemble regressor with 11 engineered features |
| **LSTM** | Long Short-Term Memory (requires PyTorch; falls back to RF) |
| **M/M/c Optimizer** | Erlang-C formula + weighted multi-objective enumeration |
| **Discrete-Event Sim** | Fixed vs Rule-based vs Optimization strategy comparison |

**Feature engineering**: hour-of-day, day-of-week, lagged arrivals (lag-1,2,4), lagged waiting, lagged completions, rolling mean/std.

**Evaluation**: Chronological 70%/15%/15% train/val/test splits. Metrics: MAE, RMSE, sMAPE.

---

## 🖥️ Application Pages

| Page | Description |
|------|-------------|
| **Dashboard** | KPI cards, queue timeline, hourly patterns |
| **Live Queue** | Simulation start/stop, real-time queue monitoring |
| **Departments** | CRUD for government departments |
| **Counters** | Open/close counters with status toggle |
| **Staff** | Availability management |
| **Data Import** | CSV upload with dry-run validation |
| **Forecasting** | Model training, evaluation metrics, forecast chart |
| **Optimization** | Allocation recommendations + human review workflow |
| **What-If Simulation** | Strategy comparison across 3 allocation approaches |
| **Explainability** | Feature importance, recommendation rationale, narratives |
| **Analytics** | Historical trends, hourly patterns, performance KPIs |
| **Reports** | CSV/PDF export |
| **Users** | User creation and role management |
| **Settings & Audit** | Audit trail, system info, ethics disclosure |

---

## 🐳 Production (Docker Compose)

```bash
docker-compose up --build
```
- PostgreSQL on port 5432
- Backend API on port 8000
- Frontend (Nginx) on port 80

---

## ⚠️ Research Ethics & Limitations

- **All data is synthetic**: Q-Sense uses simulated queue data only, not real government operational data
- **Human-in-the-loop**: All optimization recommendations require explicit human approval
- **Simulation only**: Live queue data comes from a discrete-event simulator, not physical sensors
- **Model limitations**: ML models trained on synthetic data; real-world accuracy may differ significantly
- **Research prototype**: Not production-ready for government deployment
- **Privacy**: No real citizen or employee data is collected or processed

---

## 📄 License

Research prototype — not licensed for commercial use. All data is synthetic.
