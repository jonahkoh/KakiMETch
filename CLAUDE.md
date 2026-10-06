# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Product context, scope boundaries and business rules (assessment criteria, matching algorithm, data model, what is out of scope) live in AGENTS.md — read it first:

@AGENTS.md

Also see `docs/architecture.md` + `docs/architecture.excalidraw` (component and trip-lifecycle diagram; update it and re-export `architecture.png` when services or endpoints change), `docs/PRODUCT.md` (users, constraints) and `docs/DESIGN.md` (visual system: "case-file blocks", one teal accent, Segoe UI, 16px baseline, never show numeric match scores in the UI).

## Commands

Root `Makefile`: `make install`, `make dev` (frontend + backend together), `make install-hooks` (enables `.githooks/`).

**Backend**: four services under `backend/services/{assessment,matching,registry,scheduling}` (ports 8001–8004) plus shared lib `backend/libs/kakimetch_common`. Config comes from `backend/.env` (copy `.env.example`), found by walking up from the cwd.

```bash
docker compose up --build                  # repo root: all four services
make install-backend && make dev-backend   # without Docker: editable lib + all service reqs, 4 uvicorns with --reload
cd backend && pytest services/matching     # one unit (also libs/kakimetch_common, scripts)
cd backend && pytest services/matching/tests/test_matching_service.py::test_ranking_filters_unavailable_and_conflicting_escorts
cd backend && black services libs scripts  # CI runs black --check per unit
python -m scripts.load_demo_data           # from backend/: clients via registry POST /registry/import (REGISTRY_API_URL), escorts + trips direct (idempotent)
python -m scripts.prepare_matching_demo    # from backend/: POSTs pending trips to the assessment service (ASSESSMENT_API_URL)
make k8s-images && make k8s-secret && make k8s-forward   # minikube + Argo CD; see k8s/README.md
```

**Frontend** (run from `frontend/`; `.env.local` holds `NEXT_PUBLIC_{ASSESSMENT,MATCHING,REGISTRY,SCHEDULING}_API_URL`, defaults ports 8001–8004):

```bash
npm run dev
npm run format:check && npm run lint && npm run typecheck
npm test                                   # vitest (jsdom), co-located *.test.tsx
npx vitest run src/components/matching-workspace.test.tsx
npm run test:e2e                           # playwright, desktop + mobile projects, starts dev server on :3100
npm run build
```

CI (`.github/workflows/ci.yml`) runs a backend matrix (one job per service/lib/scripts), `docker compose build`, the frontend checks, `npm audit`, `pip-audit`, gitleaks, and a commit-message check.

## Conventions enforced by hooks/CI

- **Conventional Commits** required: `type(scope): summary` with types build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test (scope lowercase).
- Pre-commit hook blocks staged merge-conflict markers.
- `frontend/AGENTS.md`: this repo uses **Next.js 16** with breaking changes vs. training data — read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next.js code.

## Architecture

```
frontend (Next.js 16) --fetch--> assessment :8001 | matching :8002 | registry :8003 | scheduling :8004 --psycopg2--> Supabase Postgres
```

- **Frontend never talks to Supabase directly**; `frontend/src/lib/api.ts` routes each call via `request(service, path)` to that service's base URL. Next.js only inlines `NEXT_PUBLIC_*` read by literal name, so keep `SERVICE_URLS` literal. Playwright sets all four URLs to `""` and mocks with `page.route("**/...")`.
- **Each service** is its own FastAPI app with Python package `app` (`app/main.py` = one `create_app(...)` call, `app/routes`, `app/schemas`, `app/services`), its own `requirements.txt`, `pytest.ini` and `Dockerfile` (build context is `backend/`). Services never import each other; shared code goes in `kakimetch_common` (`web.create_app` for CORS + `/health`, `config`, `database.get_connection()`, `escort_rules` = hard filters + `load_escorts_for_slot` conflict query used by matching and scheduling, `excel` helpers used by registry and scripts).
- **Layering inside a service**: routes (thin, map service exceptions to status codes) → services (logic + raw SQL) → `get_connection()` (one psycopg2 connection per call, `RealDictCursor`, commit/rollback). No ORM.
- **Ownership**: assessment = accept/reject a trip; matching = top-K `rank_escorts` (pure), queue, editable matching profile, full roster for manual override; registry = patient CRUD, soft delete/restore, `.xlsx` import; scheduling = create trip, confirm escort (`AssignmentOverrideRequiredError` unless override reason), cancel, schedule view.
- **Tests** don't need a database: pure functions are tested directly, DB services by monkeypatching `get_connection` on the service module. Each service has `tests/test_routes.py` pinning its exact `(method, path)` set — update it when adding an endpoint.
- **Kubernetes**: `k8s/app/` is plain YAML (Deployment + Service per service) deployed by Argo CD via `k8s/argocd-app.yaml`; the `kakimetch-env` Secret is created by hand from `backend/.env` and never committed. Images are `kakimetch-<svc>:latest` built into minikube (`imagePullPolicy: Never`).
- **Trip lifecycle** is driven by `trips.status` (pending → accepted/rejected → scheduled); matching is only allowed on accepted trips.

## Database

- `supabase/migrations/` is the schema — add a new timestamped SQL file and apply manually via the Supabase SQL Editor; a fresh database is all migrations in filename order.
- Tables: `elderly_clients` (soft delete via `deleted_at`; NRIC uniqueness only applies to active rows), `escorts`, `trips`.
- NRIC and escort contact details exist in the DB but must never appear in API response models or the UI.
- The demo importer and `POST /registry/import` share the same 26-column Excel mapping from `data/Dummy_MasterData_Updated.xlsx`.
