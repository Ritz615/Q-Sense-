# Q-Sense — Intelligent Queue Management System

> **A Deep Learning and Optimization-Based Decision Support System for Queue Prediction, Computer Vision Occupancy Sensing, and Dynamic Resource Allocation in Government Offices**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 19](https://img.shields.io/badge/react-19.0-61dafb.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.14+-ee4c2c.svg)](https://pytorch.org/)
[![OR-Tools](https://img.shields.io/badge/Google%20OR--Tools-9.15+-4285F4.svg)](https://developers.google.com/optimization)
[![Tests Passing](https://img.shields.io/badge/tests-28%20passed-brightgreen.svg)]()

---

## 📌 Executive Summary

**Q-Sense** is a full-stack, university-grade intelligent Queue Management System (QMS) and decision-support platform designed to eliminate citizen congestion, bottlenecks, and unpredictable waiting times in civic municipal offices and government service centers.

The system integrates four technological pillars into a unified operational platform:
1. **Real-Time Queue Management System (QMS)**: Live multi-counter operator workstations, citizen self-service ticket dispenser kiosks, airport/bank electronic audio chimes, text-to-speech token announcements, and public overhead calling displays.
2. **Computer Vision (CV) Occupancy Sensing**: YOLO-style pedestrian detection, centroid tracking, and interactive normalized Region-of-Interest (ROI) polygon calibration for physical waiting rooms.
3. **Multi-Model Forecasting Engine**: 6 predictive models (Baseline, Exponential Smoothing, Random Forest, Gradient Boosting, PyTorch LSTM, PyTorch TCN) predicting arrival surges 15 to 60 minutes in advance.
4. **Operations Research Optimization (MILP)**: Mixed-Integer Linear Programming via Google OR-Tools and queueing theory ($M/M/c$ Erlang C) that dynamically balances staff skills, counter availability, and service level agreements (SLAs).

---

## 🏗️ System Architecture

```
Q-Sense/
├── backend/                       # FastAPI + SQLAlchemy Async Service
│   ├── app/
│   │   ├── api/                   # REST endpoints (auth, queue tickets, camera, forecasting, optimization…)
│   │   ├── core/                  # Security, JWT auth, environment settings
│   │   ├── database/              # Async SQLite/PostgreSQL session, schema, seed data
│   │   ├── models/                # SQLAlchemy ORM models (QueueTicket, QueueEvent, Department, Counter…)
│   │   ├── schemas/               # Pydantic validation & transfer schemas
│   │   └── services/              # Business logic (CV inference, ML forecasting, OR-Tools MILP, DES simulation)
│   ├── tests/                     # Automated pytest suite (28 passing tests)
│   ├── pytest.ini                 # Pytest test discovery configuration
│   └── requirements.txt           # Python dependencies
│
├── frontend/                      # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── pages/                 # 15 interactive operational pages (LiveQueue, Forecasting, Optimization…)
│   │   ├── components/            # Reusable UI widgets (MetricCard, StatusBadge, Alert, PageLoader…)
│   │   ├── layouts/               # AppLayout with notification bell, live feeds, role badges
│   │   ├── services/              # Axios client API bindings (dashboardApi, tickets, forecastingApi…)
│   │   └── tests/                 # Vitest component & API test suites (5 passing tests)
│   ├── package.json
│   └── vite.config.ts
│
├── ml/                            # Machine Learning & Computer Vision Library
│   ├── computer_vision/           # Person detector, CentroidTracker, camera streamer, ROI HUD
│   ├── forecasting/               # Baseline, ExpSmooth, RandomForest, GradientBoosting, PyTorch LSTM, PyTorch TCN
│   ├── optimization/              # Erlang C Queue Theory, Google OR-Tools MILP Allocation Solver
│   ├── simulation/                # Discrete-event engine (Fixed, Rule-based, Optimization) + Monte Carlo
│   ├── preprocessing/             # Autoregressive lags, rolling statistics, chronological train/test split
│   └── evaluation/                # MAE, RMSE, sMAPE, WAPE, peak vs. off-peak breakdown
│
├── research/                      # Academic Research & Empirical Benchmarks
│   ├── RESEARCH_METHODOLOGY.md    # Formal mathematical formulation, proofs, and benchmarks
│   ├── training_summary.json      # Model training metrics across all departments
│   └── experimental_results.json  # Sensitivity analysis and comparative benchmark outputs
│
├── scripts/                       # Reproducible Automation Scripts
│   ├── seed_data.py               # Database initialization & synthetic seeding
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
- **Git**

---

### Step 1: Start the Backend API Server

```bash
# Navigate to the backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt greenlet

# Seed database with users, departments, counters, staff skills, cameras, and tickets
python ../scripts/seed_data.py

# Launch FastAPI development server with hot-reload
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Backend API URL**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### Step 2: Start the Frontend Application

```bash
# Open a second terminal and navigate to the frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```

- **Frontend Application URL**: [http://localhost:5173](http://localhost:5173)

---

### Default Credentials

| Role | Username | Password | Access Privileges |
|------|----------|----------|-------------------|
| **System Administrator** | `admin` | `QSense@Admin2024` | Full access, user management, policy deployment, ML training, camera calibration |
| **Counter Operator** | `operator` | `Operator@2024` | Workstation queue operations, token dispatch, citizen docket logging |

---

## 📖 Complete Working Guide & Feature Walkthrough

### 1. Queue Management System (`/queue`)

The `/queue` view provides an end-to-end suite of queue operations with 4 integrated modes:

#### A. Operator Workstation Mode
- **Counter & Department Switcher**: Select your active service zone (e.g. *Certificate & Document Services*, *Revenue & Tax*, *ID Verification*) and assigned counter (e.g. *Counter #01*, *Counter #04*).
- **Counter Duty Status**: Switch between `OPEN (Serving)`, `ON BREAK`, and `CLOSED`.
- **Calling Citizens**:
  - Click **CALL NEXT TOKEN** or press <kbd>Space</kbd> / <kbd>Enter</kbd> to dispatch the next ticket in line.
  - The ticket displays the citizen's identity, docket ID, category, and an active elapsed service timer with SLA health progression.
  - Prioritizes special categories (*Senior Citizens / Differently-Abled*, *Fast-Track Online Appointments*, *VIP*).
- **Audio Chime & Text-to-Speech Announcements**:
  - Automatically plays a two-tone airport/bank electronic chime.
  - Uses the browser Web Speech API to announce aloud: *"Token C D S 1 4 3, please proceed to Counter 4"*.
  - Use the speaker button in the top bar to toggle sound on or off.
- **Operator Command Hotkeys**:
  - <kbd>Space</kbd> / <kbd>Enter</kbd>: **Call Next Token**
  - <kbd>R</kbd>: **Re-Announce** (re-plays chime + voice speech)
  - <kbd>C</kbd>: **Complete & Log** (records duration, logs to audit history, and calls next citizen)
  - <kbd>H</kbd>: **Hold / Suspend** (moves citizen to On-Hold tray if documents are missing)
  - <kbd>T</kbd>: **Transfer Citizen** (modal to transfer citizen to another department)
  - <kbd>X</kbd>: **Mark No-Show** (records abandoned ticket and calls next)
- **On-Hold Tray**:
  - Citizens waiting for photocopies, notary stamps, or fee payments appear in the dedicated **On-Hold Citizens** tray.
  - Click **Resume** to immediately bring them back into service at your desk.
  - Click **Line** to return them to the general waiting queue.
- **Expedite Any Ticket**: Click any citizen ticket in the **Live Queue Stream** to immediately prioritize and call them directly.
- **Simulate Arrivals**: Toggle the **Auto-Arrivals** switch in the top bar to simulate realistic citizen walk-ins entering the queue stream every 18 seconds.

#### B. Citizen Ticket Kiosk Mode (Dispenser)
- A self-service or reception touch kiosk to issue real tickets.
- **Select Department**: Certificate & Document Services, Revenue & Tax, ID Verification, General Support.
- **Select Service**: Birth Certificate, Property Tax, ID Verification, Driver Licensing, etc.
- **Enter Citizen Name & Priority**: Standard, Senior Citizen/Disabled Priority, Fast-Track, VIP.
- **Issue Ticket**: Generates a ticket number (e.g. `CDS-149`), logs an arrival event, estimates waiting time, and renders a digital boarding pass / thermal receipt slip.

#### C. Public TV Calling Board Mode
- Fullscreen overhead civic hall display screen.
- Displays large **NOW SERVING** counter boxes showing currently engaged tickets and names across all active counters.
- Visual pulse and glow highlight whenever a counter calls a new token.
- Displays an upcoming citizen ticker and a live scrolling public announcement marquee.

#### D. Computer Vision Camera Mesh Mode
- Real-time video stream (webcam, RTSP stream, or synthetic queue video).
- Real-time YOLO-style edge detection estimating people count, smoothed occupancy, and FPS.
- Interactive normalized **Region of Interest (ROI)** sliders (`X Min`, `Y Min`, `X Max`, `Y Max`) to calibrate the detection zone and eliminate false positives from corridors or waiting hall seating.

---

### 2. Executive Dashboard (`/`)
- **Key Performance Indicators**: Clickable cards leading directly to sub-modules:
  - *Active Queue Backlog* &rarr; `/queue`
  - *Average Wait Time* &rarr; `/analytics`
  - *Open Desks & Utilization* &rarr; `/counters`
  - *Hourly Throughput* &rarr; `/optimization`
  - *Next-Hour Forecast* &rarr; `/forecasting`
- **Interactive Service Zones (Zone A, B, C, D)**:
  - Click between **Zone A (Licensing)**, **Zone B (Vital Records)**, **Zone C (Cashier)**, and **Zone D (Express Kiosks)**.
  - Synchronizes the live camera HUD monitor (`CAM-01A`, `CAM-04B`) and updates departmental wait-time arrival curves.
- **Live Notifications**: Notification bell in the header streams live workstation events directly from the database.

---

### 3. Forecasting Suite (`/forecasting`)
- **Interactive Multi-Model Training**:
  - Select department (e.g. *Certificate & Document Services*).
  - Select model: *Baseline*, *Exponential Smoothing*, *Random Forest*, *Gradient Boosting*, *PyTorch LSTM*, or *PyTorch TCN*.
  - Select horizon: 15 min, 30 min, 45 min, 60 min.
  - Click **Train Model** to trigger model training and generate evaluation benchmarks.
- **Interactive Evaluation Metric Pills**:
  - Switch between `MAE (min)`, `RMSE (pax)`, `MAPE (%)`, `Inference Latency`, and `Resource Gain Delta` to dynamically re-rank models and update statistical benchmark cards.
- **Operational Trajectory Chart**:
  - Live SVG trajectory curves comparing Ground Truth, TFT/LSTM attention prediction, and baseline models over a 12-hour surge cycle.
- **Dataset & Weights Export**:
  - Download full historical CSV training corpus via `Export Corpus (CSV)`.
  - Download trained model weights manifest via `Download Weights (ONNX/PT)`.

---

### 4. Operations Research Optimization (`/optimization`)
- **MILP Allocation Solver (Google OR-Tools)**:
  - Solves optimal desk allocation under staff skill matrices and SLA thresholds.
- **Policy Presets**:
  - Click **Balanced Operations**, **Strict SLA First**, or **Cost Saver / Idle Minimize** to automatically solve and recalculate optimal counter assignments.
- **Schedule Deployment & Simulation**:
  - Click **Simulate Kiosk Greeter Shift** to test triage routing.
  - Click **Deploy Schedule to Live Floor** to commit optimization recommendations directly to database operational events.
- **PDF & CSV Export**:
  - Export formal audit-ready PDF summary reports or CSV tabular data directly from the backend.

---

### 5. What-If Discrete-Event Simulation (`/simulation`)
- Configure arrival rates, service times, and target departments.
- Compare three staffing policies head-to-head:
  1. **Fixed Staffing**: Static desk schedule.
  2. **Rule-Based Staffing**: Reactive threshold-based counter opening.
  3. **Optimization-Based Staffing**: Proactive predictive allocation using ML arrival forecasts.
- Monte Carlo multi-trial analysis with stochastic confidence intervals.

---

### 6. Explainable AI & Human-in-the-Loop (`/explainability`)
- Feature attribution analysis identifying primary wait-time drivers (e.g. rain delays, transit schedules, system resets).
- Natural language decision rationale translating mathematical optimization decisions into plain English for public office supervisors.

---

## 🧪 Testing & Verification

### Running Backend Unit & Integration Tests (pytest)
```bash
cd backend
python -m pytest tests -q
```
**Output**: `28 passed in 12.04s`

### Running Frontend Tests (Vitest)
```bash
cd frontend
npm test -- --run
```
**Output**: `5 passed in 31s`

### Verifying Frontend Production Build
```bash
cd frontend
npm run build
```
**Output**: `✓ built in 3.77s` (Zero TypeScript or bundling errors)

### Headless Verification Smoke Test
```bash
python scripts/run_demo.py
```
**Output**: Verifies all 6 core subsystems (Database, CV, Forecasting, OR-Tools MILP, Discrete-Event Simulation, PDF Reports).

---

## 🐳 Docker Deployment

To run the entire Q-Sense stack using Docker Compose:

```bash
docker-compose up --build
```
- **PostgreSQL**: Port `5432`
- **FastAPI API**: Port `8000`
- **Nginx Frontend**: Port `80`

---

## ⚠️ Research Ethics, Privacy & Disclaimers

1. **Synthetic Data**: All default datasets, queue traces, citizen identities, and observations are synthetically generated for academic research and benchmarking; no proprietary citizen data is included.
2. **Human-in-the-Loop Safeguard**: Q-Sense is structured strictly as a **Decision Support System (DSS)**. Optimization recommendations require explicit human administrative approval before counter allocations take effect.
3. **Computer Vision Privacy**: Visual monitoring operates strictly on silhouettes, bounding boxes, and centroid tracking for spatial occupancy estimation. No facial recognition or biometric identity features are captured, stored, or processed.
4. **Hardware Fallback**: Physical cameras are optional. If a camera is unavailable, the system automatically runs synthetic video streams for zero-hardware evaluation.

---

## 📄 License

This research prototype was developed for academic, educational, and benchmarking purposes. Released under the MIT License.
