# KakiMETch backend

## Setup

1. Create a local `.env` file using `.env.example` and add the Supabase database password.
2. Install the packages in `requirements.txt` in the selected Python environment.
3. Apply the SQL files in `../supabase/migrations/` through the Supabase SQL Editor, in filename order.
4. Run the demo import from the `backend` directory with `python -m scripts.load_demo_data`.
5. Start the API with `uvicorn app.main:app --reload`.

## API endpoints

- `GET /health`
- `GET /matching-queue`
- `PATCH /elderly-clients/{elderly_id}/matching-profile`
- `POST /trips/{trip_id}/assessment`
- `GET /trips/{trip_id}/escort-suggestions?limit=3`
- `GET /trips/{trip_id}/escort-options`
- `POST /trips/{trip_id}/confirm-escort`
- `POST /trips/{trip_id}/cancel-assignment`
- `GET /schedule`
- `GET /schedule/day?service_date=YYYY-MM-DD`
- `POST /schedule/optimise`
- `PUT /schedule/plans/{plan_id}`
- `DELETE /schedule/appointments/{trip_id}`
- `PATCH /schedule/appointments/{trip_id}/return-ready`
- `GET /registry/patients`
- `GET /registry/patients/{patient_id}`
- `POST /registry/patients`
- `PUT /registry/patients/{patient_id}`
- `POST /registry/import` (multipart `.xlsx` upload, same 26-column mapping as the demo importer)

## Important notes

- The importer creates initial AIC and LH mobility statuses from wheelchair and walking-frame fields because the demo workbook does not include separate source assessments.
- Re-running the importer updates clients and escorts and avoids creating duplicate trips.
- The backend connects directly to Supabase Postgres. Do not commit the local `.env` file or database password.
- Enable Row Level Security and add authenticated-admin policies before connecting direct Supabase browser CRUD in the frontend.
- For the matching-only demo, run `python -m scripts.prepare_matching_demo` after importing the workbooks to assess pending escort-required trips and populate the matching queue.
- Vehicle scheduling uses OR-Tools with two seeded vehicles (`PC2345L` and `PC8213U`). Add `MAPBOX_ACCESS_TOKEN` to `backend/.env` for road travel times. Without it, the UI explicitly labels allocations as local prototype estimates.
- The day scheduler uses the appointment's own pickup address. It never falls back to the patient's registry address.
