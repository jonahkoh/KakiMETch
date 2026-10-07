# KakiMETch — Project Context

This file gives a coding agent (or any new contributor) full context on the project so far.
Read this before writing any code.

## 1. What this project is

KakiMETch is a tool built for **The Good Hack 2026**, hosted by GoodHub SEA x Open
Government Products, pilot partner **Loving Heart Multi-Service Centre (LH)**. The team has
been shortlisted to continue building with OGP's support.

The product is an **internal admin tool for MET (Medical Transport) service providers like
Loving Heart** — it helps LH's own admin staff manage referral intake and escort matching. It
is not a caregiver-facing app.

## 2. The problem

Loving Heart coordinates MET (transport + escort) services for elderly clients attending
medical appointments. Today this is done almost entirely manually:

- All client, escort, and schedule data lives in a **messy Excel sheet**.
- An admin (Rose) manually reviews each AIC referral against a checklist to accept/reject it.
- Rose then manually matches an accepted client to a suitable escort, considering informal
  factors (dialect, gender, weight, wheelchair-handling ability) that aren't written down
  anywhere structured.
- A separate admin (Mr Tong) manually assigns drivers/vehicles and plans routes — **this is
  explicitly out of scope for us** (see Section 4).
- Staff are in their 50s-60s and find Excel's complexity overwhelming; this is a real UX
  constraint, not just a data problem.
- Schedules are disseminated to drivers as a **photo of an Excel sheet sent via WhatsApp**,
  weekly with daily adjustments.

Two bottlenecks were identified: (1) time for AIC to send in referrals, (2) caregiver
responsiveness after Loving Heart tries to make contact.

North star metric (from product brief): **>=50% reduction in admin scheduling time.**

Product principle: **"Streamline administrative burden via automation, not replace human
judgment."** The system proposes; the admin always makes the final call. Never auto-assign
without human confirmation.

## 3. Target user

Primary: **admin staff at MET providers** (Loving Heart), specifically:
- Rose (coordinator) — handles referral intake, internal assessment, escort matching
- Mr Tong (scheduler) — handles driver/vehicle assignment and routing (out of scope for us)

## 4. Scope for the current milestone (due 4th)

Only two features:
1. **Internal assessment** — accept/reject a referral
2. **Escort matching** — suggest best-fit escorts for an accepted client

**Explicitly out of scope right now:** driver/vehicle matching and routing. That's a
different admin's job and is not part of this milestone. Don't let it creep into the data
model or services beyond what's needed to hand off cleanly later.

## 5. Internal assessment — accept/reject criteria

An elderly client's referral should be **rejected** if any of these fail, otherwise **accepted**:

- **Geographic boundary**: destination/pickup address must be within Loving Heart's service
  area (Southwest district). For the MVP, recognise destination addresses containing Boon Lay,
  Bukit Batok, Bukit Panjang, Choa Chu Kang, Clementi, Hong Kah, Jurong, Pioneer, Teban,
  Tengah, Toh Guan, Tuas, West Coast, or Yuhua. Replace this address-based approximation if
  Loving Heart later supplies an official service-area boundary.
- **Mobility**: reject if bed-bound. Accept ambulant, wheelchair users, and walking-frame users.
- **Certification / genuine need**: client must have a valid NMTS-certified window (see
  `NMTS effective date` / `NMTS expired date` fields — typically a 3-6 month certified window).
  There's also a soft check that AIC's referral and LH's own internal assessment agree (a
  referred client may have recovered mobility since being referred — this can cause a
  discrepancy worth flagging). Store these separately as `aic_mobility_status` and
  `lh_mobility_status`; use the LH-assessed value for the hard mobility decision.
- **Service agreement status**: `LH Service Agreement` / `SW Service Agreement` fields should
  both be `Y` or `Pending`; reject the referral if either is `N` or missing. These fields are
  understood to track whether the client has a signed service agreement with Loving Heart
  and/or the referring social worker/agency. **This interpretation is inferred from the field
  names in the data, not explicitly confirmed by the team** — but both are required for the
  MVP.

**Not part of assessment** (these are escort-matching inputs, used only after acceptance):
dialect, gender, weight, wheelchair-handling capability. Keep this boundary clean — assessment
and matching are two separate services and should not share this logic.

For this MVP, hardcode these checks rather than building a generalized rules engine — the
team's assessment is that LH's operations won't change often enough to justify the complexity
now. If rules need to change later, it's fine to edit the code directly.

## 6. Escort matching — how it should work

Flow: admin clicks a button for a given (already-accepted) elderly client -> system returns
**top-K best-fit escort suggestions**, each shown with "flairs" (tags) explaining the match
(e.g. gender match, dialect match) so the admin can see why at a glance. Admin picks one from
the list; the system does not auto-assign.

Constraints to take into account:
- Elderly client's requirements: needs escort (Y/N), dialect, gender preference (if any),
  wheelchair-handling need, appointment time
- Escort's attributes: gender, dialect(s) spoken, available days/timeslot, wheelchair-handling
  capability (Y/N)

Algorithm shape (simple, confirmed — not over-engineered):
1. **Hard filter**: remove escorts unavailable at the appointment's day/time, and (if the
   client needs wheelchair handling) remove escorts who can't do it. Remove escorts with a
   conflicting appointment already assigned at that slot (conflict detection).
2. **Soft scoring/sorting**: among survivors, score by dialect match and gender match (and any
   other soft signals the team adds), then sort and return the top K by score.
3. **If the hard filter removes everyone (no viable escort), this is a conflict.** Confirmed
  handling: surface it as a **soft warning**, not a blocking error — the admin can still
  proceed manually only by supplying an explicit override flag and reason. Longer-term (future
  feature, not this milestone): add appointment duration so conflicts can account for overlapping
  time ranges rather than just an identical appointment time, allow the admin to
   amend an already-booked escort's schedule directly and have the system suggest who else
   could be reallocated to cover the gap. Not building this reallocation feature yet, but keep
   the conflict-detection logic structured so it could support it later without a rewrite.

**Confirmed decision: OR-Tools is fully deferred, not used in this milestone.** The team
initially discussed Google OR-Tools for this. OR-Tools is built for large combinatorial
assignment problems (e.g. scheduling many clients to many drivers/vehicles/routes at once).
For "rank escorts for one client," a plain Python filter + sort/scoring function is simpler,
faster to build, and easier for teammates to pick up under time pressure. If a future phase
tackles full daily schedule / route optimization across multiple clients and vehicles at once
(which would fall under the currently out-of-scope driver-matching problem), OR-Tools can be
revisited then.

Driver matching is explicitly excluded — leave driver as a separate/absent field from the
escort-matching engine, and don't build the interface that would connect to it yet.

## 7. Tech stack (confirmed)

- **Frontend**: Next.js
- **Backend**: **FastAPI (Python)** — confirmed.
- **Backend data access**: **direct Postgres connection** (e.g. SQLAlchemy or psycopg2), not
  the Supabase client library. Reasoning: the matching engine's core job is exactly the kind
  of multi-condition filtering (availability + wheelchair + dialect + no scheduling conflicts)
  that's far cleaner to express in real SQL than through a REST query-builder. Keeping this
  convention consistent avoids the frontend and backend ending up with two different mental
  models of "how do I get data."
- **Matching logic**: plain Python for MVP (see Section 6). Google OR-Tools fully deferred.
- **Architecture style**: microservice-ish — assessment and matching are separate services
  behind one backend API, not entangled with each other. Both read/write the same shared data
  store (no need for separate databases).

## 8. Storage / infrastructure (confirmed)

**Supabase**, not Firebase.

Reasoning:
- The data model is genuinely relational (Elderly and Escort both link to Appointment via
  foreign keys; matching queries filter/join across them), which fits Postgres (what Supabase
  runs on) far better than a NoSQL/document store like Firestore.
- Supabase's table editor UI lets non-technical teammates inspect/tweak seed data without
  touching code — closer to the Excel mental model LH staff are used to.
- Has client libraries for both Next.js (`supabase-js`) and Python, plus built-in file storage
  (useful later for the bulk-Excel-upload feature — see Section 9).
- Free tier is enough for a hackathon prototype.

See Section 7 for the split: frontend uses the Supabase client directly; backend connects
straight to the underlying Postgres database for the matching engine's filtering logic.

## 9. How new data gets into the system (confirmed)

Primary entry point (**build this first**): a **single-elderly entry form** in the frontend.
Admin fills in one elderly client's details at a time; the same workflow applies regardless of
how the record was created — assessment, then matching, then admin approve/reject of the
suggested match.

**Future feature (not MVP):** a **bulk upload option accepting .xlsx files**, so an admin can
add many elderly clients at once instead of one at a time. Each row in the uploaded file would
be processed through the exact same workflow (assessment -> matching -> admin approval) as a
record entered via the single form — no separate pipeline. Do not build this for the current
milestone; the single form is the priority.

Escorts are assumed to follow the same "single entry first, bulk upload later" pattern, though
this hasn't been explicitly discussed for escorts specifically — worth confirming with the team
if it comes up.

## 10. Data model

Three core entities (see `/data` folder for dummy Excel files matching this shape):

**Elderly**
- id (PK), name, nric (omit from UI — see below), AIC-reported mobility status,
  LH-assessed mobility status, wheelchair (Y/N),
  dialect, weight_kg, gender, escort gender preference (if any), destination/address, AIC reg
  no, NMTS effective/expiry dates, service agreement status, escort required (Y/N)
- `dialect` and `weight_kg` are validated/editable fields in the frontend UI, not read-only —
  admins can view and correct them, not just have the matching engine consume them silently.

**Escort**
- id (PK), name, gender, dialect(s) spoken, available days, available timeslot,
  wheelchair-handling capable (Y/N), contact

**Appointment / Trip**
- id (PK), elderly_id (FK), escort_id (FK, nullable until matched), appt_date, appt_time,
  destination, status (e.g. pending / accepted / rejected / scheduled)

Dummy data provided by Loving Heart (in `/data`):
- `Dummy_MasterData_Updated.xlsx` — 300 elderly client records (original LH master data,
  extended with `Dialect` and `Weight (kg)` columns, which were missing from the original
  export but are needed for matching)
- `Dummy_ScheduleData_September_2026.xlsx` — September 2026 appointment schedule for the same
  300 clients (roughly a third have an actual appointment this month; rest are blank)
- `Dummy_EscortRoster.xlsx` — 20 dummy escorts generated for this project (name, gender,
  dialect(s), available days, timeslot, wheelchair-handling capability, contact) — **this
  roster did not exist in any LH-provided file and was created from scratch for the
  prototype**

**NRIC handling (confirmed): omit from the UI entirely for the prototype.** An earlier
interview note flagged that staff currently work off postal code + name as the lookup key, not
NRIC ("if given IC number, can't do anything about it"), so this aligns with actual practice.
NRIC can still exist in the underlying data/import files, just don't surface or make it
editable in the frontend.

## 11. System architecture (agreed sketch)

```
Admin (web UI, Next.js + supabase-js)
     |
     v
KakiMETch backend (FastAPI, direct Postgres access)
 ├── Assessment service   (accept/reject referrals)
 └── Matching engine      (top-K escort ranking)
          |         |
          v         v
      Data store (Supabase/Postgres — elderly, escort, trip records)
```

Assessment and matching are independent — matching is only invoked after a referral is
accepted; a rejected referral never reaches the matching engine.

Implementation note: the backend is split into four separately deployable services
(assessment, matching, registry, scheduling) under `backend/services/`, each with its own
Dockerfile, sharing `backend/libs/kakimetch_common`. The frontend calls each service directly
via its own `NEXT_PUBLIC_*_API_URL`. Current diagram: [docs/architecture.md](docs/architecture.md).

## 12. User flow (agreed sketch)

```
New referral (single form; bulk .xlsx upload is future) -> Internal assessment -> [Rejected -> stop]
                        |
                    [Accepted]
                        v
                Escort matching (top-K)
                        v
              Admin review & confirm
                        v
                 Trip scheduled
```

Driver/vehicle assignment happens after "Trip scheduled" but is a separate, human-run process
outside this system for now.

**Additional requirement: scheduled trips need a UI view.** Once a trip is confirmed, it
should be visible on a schedule view in the frontend — a list or calendar-style display showing
confirmed trips (date, elderly client, escort, destination, time) so admins can see what's been
booked. Without this, the confirm step has no visible result for admins to check against, and
LH still can't see a consolidated view of what's actually scheduled. This is required frontend
work for the milestone, not optional polish.

## 13. Vision beyond this milestone

This section captures the founding team's broader product vision, for context — it is **not**
additional scope for the current milestone. See Section 4 for what's actually in scope now, and
don't let any of this creep into the current data model or services ahead of time.

KakiMETch's overall goal: eliminate the manual, spreadsheet-and-phone-calls administrative
burden of matching escorts to elderly patients and scheduling drivers for MET (Medical Escort
and Transportation) services — by intelligently matching the right escort to each patient
(availability, location, care needs — see Section 6) and, eventually, optimizing driver
schedules for timely pickups (see Section 4's driver/vehicle exclusion — still out of scope).
Success is reduced coordinator time spent on manual scheduling (the >=50% north star from
Section 2), fewer errors and delays, and ultimately more seniors reliably reaching their medical
appointments.

**Current phase:** piloting with Loving Heart, running user interviews to understand real
workflows and refine the matching algorithm (Section 6) against actual operational needs.
Expect the hard-filter/soft-score rules described in this doc to evolve as that feedback comes
in — they are a confirmed starting point, not a final spec.

**Planned after this milestone** (not to be built now):
- Scale beyond Loving Heart to other MET providers, charities, and non-profit organisations
  across Singapore. Where it's easy to, avoid baking in Loving-Heart-only assumptions beyond
  what's already flagged as LH-specific (e.g. the Southwest-district geographic boundary in
  Section 5) — but don't over-engineer for multi-tenancy now; nothing about this milestone
  requires it.
- A dashboard for audit and reporting purposes.

The team's stated long-term vision: build a sustainable solution that can grow with rising
demand for elderly care services in Singapore.
