```markdown
# UK Wind Forecast Accuracy – Day-Ahead Market Pilot

**Anonymous repo style name:** `kjhwr-wind-forecast`

Focused pilot web application for a UK energy utility team responsible for buying power in the day-ahead market. The product helps them:

1. See the latest renewable (wind) generation forecasts that were available when day-ahead decisions needed to be made.
2. Quantitatively evaluate the accuracy of those forecasts (MAE, RMSE, MAPE, Bias) against realised generation.

**Scope (as required):** National-level wind only, using Elexon BMRS data (FUELHH actuals + WINDFOR forecasts) for **January 2026**.

**Design priority:** Accuracy of data retrieval, alignment and error metrics over visual polish.

## Tech Stack

| Layer     | Technology                                                      |
|-----------|-----------------------------------------------------------------|
| Frontend  | React 18, Redux Toolkit, Tailwind CSS, Axios, Recharts, Vite    |
| Backend   | Python 3.11, FastAPI, pandas, numpy, httpx                      |
| Local run | Docker / docker-compose                                         |
| Deploy    | Vercel (frontend + backend) or Docker on any container platform |

AI assistance was used for scaffolding and boilerplate; all domain logic, alignment rules and metric definitions were written and verified manually.

## Project Structure

```
wind-forecast-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py              # FastAPI app: data fetch, day-ahead selection, metrics
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # MetricsCard, charts, DateSelector, SummaryTable
│   │   ├── services/api.js      # Axios client
│   │   ├── store/               # Redux Toolkit slice
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
├── docker-compose.yml
├── vercel.json                  # Optional – for single-project Vercel deploy
└── README.md
```

## Key Accuracy Design Decisions

- **Day-ahead selection rule:** For delivery day D, the forecast with the latest `publishTime` that is strictly before 00:00 UTC of D is used. This approximates the information set available when day-ahead positions are taken.
- **Alignment:** WINDFOR timestamps are rounded to the nearest 30 minutes and inner-joined with FUELHH on `startTime`. Only overlapping points contribute to metrics.
- **Metrics:**
  - Error = Forecast − Actual
  - MAE, RMSE, MAPE, Bias, Max |Error|
  - Computed exclusively on the aligned series.
- **Data source:** Live calls to `https://data.elexon.co.uk/bmrs/api/v1` (no synthetic data).

---

## How to Run Locally

### Option A – Docker Compose (recommended)

Requirements: Docker and Docker Compose installed, and your user must have permission to talk to the Docker daemon.

```bash
cd wind-forecast-app
docker compose up --build
```

- Frontend: http://localhost:3000  
- Backend API docs: http://localhost:8000/docs  
- Health check: http://localhost:8000/health  

To stop:

```bash
docker compose down
```

If you see `permission denied while trying to connect to the docker API`:

```bash
sudo usermod -aG docker $USER
newgrp docker          # or log out and log back in
docker compose up --build
```

### Option B – Local development (without Docker)

**Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If `pip` times out, use a longer timeout:

```bash
pip install --default-timeout=100 -r requirements.txt
```

**Frontend** (new terminal)

```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:3000  
- The Vite dev server proxies `/api` and `/health` to the backend (see `vite.config.js`).

---

## API Endpoints (Backend)

| Method | Path                     | Purpose                                                                 |
|--------|--------------------------|-------------------------------------------------------------------------|
| GET    | /health                  | Liveness                                                                |
| GET    | /api/day-ahead           | Latest usable forecast + actuals + metrics for one delivery day         |
| GET    | /api/accuracy-summary    | Per-day and overall metrics for a date range                            |
| GET    | /api/actuals             | Raw FUELHH wind actuals                                                 |
| GET    | /api/forecasts           | Raw WINDFOR forecasts                                                   |
| GET    | /api/available-dates     | Helper listing the January 2026 scope                                   |

Interactive documentation is available at `/docs` when the backend is running.

---

## Deployment

### 1. Docker (any container host)

The same `docker-compose.yml` used locally can be deployed on any host that supports Docker (VPS, Railway, Render, Fly.io, etc.).

```bash
docker compose up --build -d
```

Expose ports 3000 (frontend) and 8000 (backend) or put a reverse proxy in front.

### 2. Vercel (recommended for quick public demo)

You can deploy the frontend and backend as **two separate Vercel projects** from the same GitHub repository (simplest and most reliable).

#### Frontend on Vercel

1. Import the GitHub repo in Vercel.
2. Click **Import single project** next to `frontend`.
3. Settings:
   - Root Directory → `frontend`
   - Framework Preset → Vite
   - Build Command → `npm run build`
   - Output Directory → `dist`
4. Add Environment Variable:
   - `VITE_API_URL` = public URL of your backend (e.g. `https://your-backend.vercel.app`)
5. Deploy.

#### Backend on Vercel

1. Import the **same** GitHub repo again as a new Vercel project.
2. Click **Import single project** next to `backend`.
3. Root Directory → `backend`.
4. Ensure `backend/requirements.txt` contains at least:

   ```txt
   fastapi
   mangum
   httpx
   pandas
   numpy
   python-dateutil
   pydantic
   ```

5. Add a small ASGI adapter so Vercel can run FastAPI (create `backend/api/index.py` or equivalent entry that Vercel detects):

   ```python
   from mangum import Mangum
   from app.main import app
   handler = Mangum(app, lifespan="off")
   ```

6. Deploy. After it is live, copy the URL and set it as `VITE_API_URL` on the frontend project, then redeploy the frontend.

> **Note:** FastAPI + pandas/numpy on Vercel serverless can hit cold-start and timeout limits on the Hobby plan. For heavier use, prefer a container platform for the backend and keep only the frontend on Vercel.

### 3. Single-repo multi-service on Vercel (advanced)

If you prefer one Vercel project, add a root `vercel.json` and an `api/index.py` Mangum handler that imports the existing FastAPI app. See project discussion / commit history for the exact configuration.

---

## Environment Variables

| Variable         | Where used | Description                                      |
|------------------|------------|--------------------------------------------------|
| `VITE_API_URL`   | Frontend   | Base URL of the backend. Leave empty for same-origin or local proxy. |

No API key is required for the public Elexon Insights endpoints used by this pilot.

---

## Licence / Data

Data © Elexon / National Energy System Operator. Usage subject to BMRS Data Licence Terms. This pilot is for evaluation purposes only.

---

Built with a deliberate emphasis on correct quantitative evaluation of wind forecast accuracy for day-ahead procurement decisions.
```