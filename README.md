# Q-Sense — Intelligent Queue Management System

> **A Deep Learning and Optimization-Based Decision Support System for Queue Prediction, Computer Vision Occupancy Sensing, and Dynamic Resource Allocation in Government Offices**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 19](https://img.shields.io/badge/react-19.0-61dafb.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.14+-ee4c2c.svg)](https://pytorch.org/)
[![OR-Tools](https://img.shields.io/badge/Google%20OR--Tools-9.15+-4285F4.svg)](https://developers.google.com/optimization)

---

## 📌 Executive Summary

**Q-Sense** is an end-to-end, university-grade research prototype addressing severe citizen waiting times and operational bottlenecks in public sector and municipal offices. It integrates:
1. **Computer Vision (CV) Queue Occupancy Monitoring**: Real-time person detection, centroid tracking, ROI bounding filtering, and adaptive synthetic fallback.
2. **Multi-Model Forecasting Engine**: 6 predictive models (Baseline, Exponential Smoothing, Random Forest, Gradient Boosting, PyTorch LSTM, PyTorch TCN).
3. **Operations Research Optimization**: Mathematical Mixed-Integer Linear Programming (MILP via Google OR-Tools) and queueing theory ($M/M/c$ Erlang C) under staff skill and counter capacity constraints.
4. **Discrete-Event Simulation (DES)**: Realistic simulation engine supporting Fixed, Rule-based, and Optimization-based policies with Monte Carlo multi-trial evaluation.
5. **Explainable AI (XAI)**: Feature attribution, wait-time driver decomposition, and human-in-the-loop decision rationale.
6. **Dual-Mode Frontend Dashboard**: Real-time operational simulation alongside live annotated computer vision camera feeds.

Formal methodology, mathematical models, and empirical benchmark findings are documented in [`research/RESEARCH_METHODOLOGY.md`](research/RESEARCH_METHODOLOGY.md).

---

## 🏗️ System Architecture

```
Q-Sense/
├── backend/                       # FastAPI + SQLAlchemy Backend Service
│   ├── app/
│   │   ├── api/                   # REST endpoints (auth, camera, dashboard, forecasting, optimization, simulation…)
│   │   ├── core/                  # Security, JWT auth, environment configuration
│   │   ├── database/              # Async SQLite/PostgreSQL session, migrations, seed data
│   │   ├── models/                # SQLAlchemy ORM models (CameraSource, Staff, Counters, Departments…)
│   │   ├── schemas/               # Pydantic validation & transfer schemas
│   │   └── services/              # Business logic (CV, ML forecasting, MILP optimization, simulation)
│   ├── tests/                     # 27 comprehensive automated pytest cases
│   ├── pytest.ini                 # Pytest configuration
│   └── requirements.txt           # Python dependencies
│
├── frontend/                      # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── pages/                 # 15 interactive dashboard views (LiveQueue, Forecasting, Optimization…)
│   │   ├── components/            # Reusable UI widgets (MetricCard, StatusBadge, Alert, PageLoader…)
│   │   ├── services/              # Axios API client bindings (including cameraApi)
│   │   └── tests/                 # Vitest component & API test suites
│   ├── package.json
│   └── vite.config.ts
│
├── ml/                            # Self-contained ML & Vision Library
│   ├── computer_vision/           # Person detector, CentroidTracker, CameraStreamProcessor, ROI HUD
│   ├── forecasting/               # Baseline, ExpSmooth, RandomForest, GradientBoosting, PyTorch LSTM, PyTorch TCN
│   ├── optimization/              # Erlang C Queue Theory, Google OR-Tools MILP Allocation Solver
│   ├── simulation/                # Discrete-event engine (Fixed, Rule-based, Optimization) + Monte Carlo
│   ├── preprocessing/             # Autoregressive lags, rolling statistics, chronological train/val/test split
│   ├── evaluation/                # MAE, RMSE, sMAPE, WAPE, peak vs. off-peak breakdown
│   └── data/                      # Synthetic 30-day queue dataset generator
│
├── research/                      # Academic Research & Empirical Benchmarks
│   ├── RESEARCH_METHODOLOGY.md    # Formal mathematical formulation, proof sketches, and experimental results
│   ├── training_summary.json      # Model training metrics across all departments
│   └── experimental_results.json  # Sensitivity analysis and comparative benchmark outputs
│
├── scripts/                       # Reproducible CLI Runners
│   ├── seed_data.py               # Database initialization & seeding
│   ├── generate_synthetic_dataset.py # 30-day synthetic dataset generation
│   ├── train_models.py            # Train & evaluate all 6 forecasting models
│   ├── run_experiments.py         # Comparative benchmark & sensitivity analysis
│   └── run_demo.py                # End-to-end system verification smoke test
│
├── docker-compose.yml             # Containerized multi-service deployment
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.11 or higher
- **Node.js**: 18+ and `npm`
- **C/C++ Build Tools**: Not required (all dependencies utilize pre-built wheels)

---

### Step 1: Backend Setup & Database Seeding

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt greenlet

# Seed database with users, departments, counters, staff skills, cameras, and historical observations
python ../scripts/seed_data.py

# Launch the FastAPI dev server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive API Documentation (Swagger)**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Alternative ReDoc**: [http://localhost:8000/api/redoc](http://localhost:8000/api/redoc)

---

### Step 2: Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install npm packages
npm install

# Run Vite development server
npm run dev
```

- **Frontend Web Application**: [http://localhost:5173](http://localhost:5173)

---

### Default Credentials

| Role | Username | Password | Privileges |
|------|----------|----------|------------|
| **Admin** | `admin` | `QSense@Admin2024` | Full access, user management, policy approval, camera management |
| **Operator** | `operator` | `Operator@2024` | Operational monitoring, simulation control, queue servicing |

---

## 🧠 Core Engineering Capabilities

### 1. Computer Vision Queue Occupancy Sensing
- **Camera Types**: Supports physical webcams, recorded video files, and high-fidelity synthetic queue streams.
- **Adaptive Detection**: OpenCV person contour and silhouette detector calibrated for vertical aspect ratio pedestrian tracking without requiring external GPU/CUDA weights.
- **Region of Interest (ROI)**: Dynamic normalized bounding box filtering (`[x_min, y_min, x_max, y_max]`) allowing operators to exclude hallways and non-queue seating areas.
- **Temporal Tracking & Smoothing**: Dual-stage exponential smoothing and median filtering suppresses frame-to-frame flicker and transient visual occlusion.
- **Live Annotated Feed**: Real-time HUD overlay streaming base64 JPEG snapshots displaying detection bounding boxes, active tracking IDs, and ROI boundaries.

### 2. Multi-Model Forecasting Suite
- **Historical Baseline**: Time-of-day seasonal profile serving as a benchmark.
- **Exponential Smoothing**: Holt-Winters inspired autoregressive smoothing ($\alpha=0.3$).
- **Random Forest**: 100-tree ensemble over 11 engineered features (lags, rolling stats, calendar indicators).
- **Gradient Boosting**: Sequential residual decision tree boosting.
- **PyTorch LSTM**: Recurrent neural network mapping sequential queue history to future arrival volume.
- **PyTorch TCN**: Temporal Convolutional Network with dilated causal 1D convolutions and residual blocks.

### 3. Operations Research Optimization (Google OR-Tools)
- **Mathematical Model**: Mixed-Integer Linear Program (MILP) solved using SCIP/CBC solvers.
- **Objective**: Minimize weighted sum of predicted citizen wait time, counter opening costs, and staff idle penalty.
- **Hard Constraints**:
  - Exact staff skill matching (staff qualification matrix $Q_{s,k} \in \{0, 1\}$).
  - Counter occupancy limits (at most one staff member per counter).
  - Department capacity limits and minimum service level agreements (SLAs).

### 4. Discrete-Event Simulation & Policy Evaluation
- **Simulation Strategies**:
  - `Fixed`: Static, non-adaptive counter staffing.
  - `Rule-Based`: Reactive threshold scaling (opens counter when queue $> 8$, closes when idle $> 5$).
  - `Optimization-Based`: Proactive mathematical reallocation based on predicted demand.
- **Monte Carlo Analysis**: Multi-trial stochastic evaluation reporting confidence intervals for wait times, queue lengths, and counter utilization.

---

## 🔬 CLI Research & Verification Scripts

All experiments and research workflows can be run headlessly from the command line:

```bash
# 1. Generate 30 days of high-fidelity synthetic queue observations
python scripts/generate_synthetic_dataset.py

# 2. Train and evaluate all 6 forecasting models across all departments
python scripts/train_models.py

# 3. Execute comparative benchmark and sensitivity experiments
python scripts/run_experiments.py

# 4. Run full end-to-end subsystem verification smoke test
python scripts/run_demo.py
```

---

## 🧪 Automated Testing Suite

The repository includes comprehensive automated tests covering both backend API/ML components and frontend UI interactions.

### Backend Test Suite (pytest)
```bash
cd backend
pytest -c pytest.ini tests -v
```
**Results**: **27 passed** across authentication, camera feeds, CRUD, data import, forecasting, MILP optimization, PDF/CSV reporting, and discrete-event simulation.

### Frontend Test Suite (Vitest)
```bash
cd frontend
npm test
```
**Results**: **5 passed** covering UI component rendering (`StatusBadge`, `MetricCard`, `Alert`, `PageLoader`) and Axios API client bindings.

### Frontend Production Build
```bash
cd frontend
npm run build
```
**Results**: Verified clean TypeScript compilation and asset packaging with zero errors.

---

## 🖥️ Application Pages Overview

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Executive overview, KPI cards, real-time queue timeline, hourly patterns |
| **Live Queue** | `/live` | **Dual-Mode**: Mode A (Operational Simulation) + Mode B (Computer Vision Camera Feed with live annotated visual HUD and interactive ROI sliders) |
| **Departments** | `/departments` | Manage departmental service types, SLAs, and capacity |
| **Counters** | `/counters` | Physical counter configuration, operational status toggles, service assignments |
| **Staff** | `/staff` | Staff directory, availability statuses, and skill qualification matrix |
| **Data Import** | `/import` | CSV batch ingestion with dry-run schema validation |
| **Forecasting** | `/forecasting` | Multi-model training, chronological evaluation metrics, and demand forecasting charts |
| **Optimization** | `/optimization` | MILP resource allocation recommendations with human-in-the-loop review workflow |
| **What-If Simulation** | `/simulation` | Compare Fixed vs. Rule-based vs. Optimization policies across stochastic scenarios |
| **Explainability** | `/explainability` | Feature attributions, arrival drivers, and human-readable natural language rationale |
| **Analytics** | `/analytics` | Historical trends, hourly heatmaps, SLA compliance rates |
| **Reports** | `/reports` | Exportable PDF and CSV analytical reports with data tables |
| **Users** | `/users` | User management and role-based permissions (Admin / Operator) |
| **Settings & Audit** | `/settings` | System configuration, immutable audit trail, and research ethics disclosure |

---

## 🐳 Docker Container Deployment

To launch the full stack using Docker Compose:

```bash
docker-compose up --build
```
- **PostgreSQL**: Port `5432`
- **FastAPI API**: Port `8000`
- **Nginx Frontend**: Port `80`

---

## ⚠️ Research Ethics, Privacy & Limitations

1. **Synthetic Data**: All default datasets, queue traces, and observations are synthetically generated for academic research and benchmarking; no proprietary government operational data is included.
2. **Human-in-the-Loop Safeguard**: Q-Sense is structured strictly as a **Decision Support System (DSS)**. Optimization recommendations require explicit human administrative approval before counter allocations take effect.
3. **Computer Vision Privacy**: Visual monitoring operates strictly on silhouettes and bounding boxes for spatial occupancy estimation. No biometric identification, facial recognition, or personal identity features are captured, stored, or processed.
4. **Hardware Fallback**: Real camera hardware is completely optional. If a physical camera is unavailable, the system automatically falls back to an integrated synthetic queue video generator.

---

## 📄 License

This research prototype was developed for academic, educational, and benchmarking purposes. Released under the MIT License.
