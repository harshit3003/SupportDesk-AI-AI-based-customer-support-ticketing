# SupportDesk AI — AI-based customer support ticketing

| Service | Tech | Port | Role |
|---|---|---|---|
| `web` | Next.js 14 | 3000 | Agent dashboards, ticket workspace, customer form + CSAT page |
| `api` | Node/Express + MongoDB | 4000 | Tickets, routing, SLA engine, analytics, JWT auth |
| `ml-service` | Python / FastAPI / scikit-learn | 8000 | Category + priority classifier, sentiment |

## Flow
1. Customer submits `/submit` → `POST /api/tickets/public`
2. API calls the ML service (`/classify`) — falls back to keyword rules if it is down
3. Priority is bumped for angry sentiment; low-confidence predictions are flagged `needsReview`
4. Router assigns the least-loaded active agent whose skills match the category
5. SLA clock starts (first-response + resolution targets by priority); a sweeper flags breaches every minute
6. Agent replies / resolves; customer rates via `/rate/<ticketId>?email=...`
7. Dashboards aggregate SLA compliance, agent performance and CSAT in MongoDB

## Run with Docker
```bash
docker compose up --build
docker compose exec api node src/seed.js    # demo data
```
Open http://localhost:3000 — login `admin@demo.com` / `password123`.

## Run locally
```bash
# Mongo on :27017, then:
cd ml-service && pip install -r requirements.txt && python train.py && uvicorn app:app --port 8000
cd api && npm install && npm run seed && npm run dev
cd web && npm install && npm run dev
```

## Tuning
- **SLA targets**: `api/src/services/sla.js` (`SLA_POLICY`, minutes).
- **Routing logic**: `api/src/services/routing.js`.
- **Real training data**: drop `ml-service/data/tickets.csv` (`subject,body,category,priority`) and rerun `python train.py`. The bundled model trains on synthetic data, so metrics from it are not meaningful.
- **Retraining loop**: when an agent changes a category, `ai.correctedCategory` is stored on the ticket — export those as labels.

## Before production
Change `JWT_SECRET`, move the token out of `localStorage` into an httpOnly cookie, add rate limiting on `/tickets/public`, sign the CSAT links, and add tests.
