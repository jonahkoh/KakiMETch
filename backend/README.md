# KakiMETch backend

Four FastAPI services sharing one Supabase Postgres database and one small shared library.

| Service | Local port | Endpoints |
|---|---|---|
| `services/assessment` | 8001 | `POST /trips/{trip_id}/assessment` |
| `services/matching` | 8002 | `GET /trips/{trip_id}/escort-suggestions?limit=3`, `GET /trips/{trip_id}/escort-options`, `GET /matching-queue`, `PATCH /elderly-clients/{elderly_id}/matching-profile` |
| `services/registry` | 8003 | `GET/POST /registry/patients`, `GET/PUT/DELETE /registry/patients/{patient_id}`, `POST /registry/patients/{patient_id}/restore`, `POST /registry/import` (multipart `.xlsx`, same 26-column mapping as the demo importer) |
| `services/scheduling` | 8004 | `POST /trips`, `POST /trips/{trip_id}/confirm-escort`, `POST /trips/{trip_id}/cancel-assignment`, `GET /schedule` |

Every service also serves `GET /health`. Shared code lives in `libs/kakimetch_common`
(`web.create_app` for CORS + `/health`, `config`, `database`, `escort_rules` for the escort
hard filters and slot-conflict query, `excel` import helpers).

## Setup

1. Create `backend/.env` from `.env.example` and add the Supabase database password.
2. Apply the SQL files in `../supabase/migrations/` through the Supabase SQL Editor, in filename order.
3. Run with Docker from the repo root: `docker compose up --build`.
   Or without Docker: `make install-backend` then `make dev-backend` (runs all four with reload).
4. Import demo data from `backend/`, with the registry service running: `python -m scripts.load_demo_data`.
   Clients go through `POST /registry/import` (set `REGISTRY_API_URL` if it is not on `http://localhost:8003`); escorts and trips are written directly.
5. For the matching-only demo, with the assessment service running:
   `python -m scripts.prepare_matching_demo` (set `ASSESSMENT_API_URL` if it is not on `http://localhost:8001`).

## Tests

Each service, the shared lib and `scripts/` are tested separately, e.g. from `backend/`:

```bash
pytest services/matching
pytest libs/kakimetch_common
pytest scripts
```

## Important notes

- The importer creates initial AIC and LH mobility statuses from wheelchair and walking-frame fields because the demo workbook does not include separate source assessments.
- Re-running the importer updates clients and escorts and avoids creating duplicate trips.
- The services connect directly to Supabase Postgres. Do not commit `.env` or the database password; `.dockerignore` keeps it out of images.
- Enable Row Level Security and add authenticated-admin policies before connecting direct Supabase browser CRUD in the frontend.
