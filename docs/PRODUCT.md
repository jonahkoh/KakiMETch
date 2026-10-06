# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

KakiMETch is an internal tool for Medical Transport service-provider administrators. Its primary user is Rose, Loving Heart's coordinator, who reviews referrals and matches accepted elderly clients with part-time escorts. Staff are generally in their 50s–60s, use Windows and Excel today, and need a workflow that is easy to scan without requiring high technical confidence.

## Product Purpose

KakiMETch reduces the manual effort and cognitive load involved in referral assessment, daily vehicle scheduling and escort matching. Success means reducing administrative scheduling time by at least 50% while keeping the administrator in control of every decision.

## Positioning

The product turns appointment and transport constraints into an editable daily vehicle plan, then layers informal escort-matching knowledge—availability, wheelchair-handling capability, dialect and gender preference—onto that plan. It proposes; the administrator always reviews and retains control.

## Operating Context

Loving Heart currently works from large Excel files, printed daily timetables and WhatsApp messages. Rose handles assessment and escort matching. Mr Tong handles drivers, vehicles and routes. Appointments and return pickup times can change at short notice, and a typical vehicle can handle roughly six to eight patient services per day.

## Capabilities and Constraints

- Current milestone capabilities are internal assessment, daily vehicle scheduling and top-K escort suggestions for accepted trips.
- Matching hard-filters escort availability, identical-time conflicts and required wheelchair capability, then soft-ranks dialect and gender preference.
- A no-viable-escort result is a warning, not a dead end; manual assignment requires an explicit override reason.
- NRIC must never appear in the interface.
- Finance, reporting, bulk Excel upload and caregiver-facing tools remain outside the current slice.
- Vehicle scheduling remains a separate module from escort matching even though escort status is displayed on the daily schedule.
- The MVP uses Next.js, FastAPI, Supabase Postgres and Google OR-Tools for daily route allocation.
- The current build uses dummy data and is not approved for public deployment with real client information until authentication and authorization are added.

## Daily Vehicle Scheduling Logic

### Workflow and source of truth

1. The administrator selects a service date in `YYYY-MM-DD` format.
2. The administrator enters each appointment for that day. The required scheduling inputs are the patient, appointment time, appointment-specific pickup address, hospital or destination, and estimated return-ready time.
3. The appointment passes through the existing internal assessment. Only accepted appointments enter the vehicle scheduler.
4. The administrator selects **See allocation** or **Run again** to invoke OR-Tools.
5. The proposed result is displayed as one swim lane per vehicle. Escort assignment status is shown on each appointment without coupling escort selection to vehicle optimisation.
6. The administrator may drag appointments between vehicles, reorder appointments within a lane, update a return-ready time, or remove an appointment. Human review is the final operational guardrail.

The appointment instance is the single source of truth for transport locations. The scheduler must never infer or substitute the patient's registry or home address as the pickup point. Older imported appointments that do not contain a pickup address or return-ready time must be completed before optimisation can run.

### Vehicles, drivers and depot

- The prototype fleet contains two vehicles: `PC2345L` and `PC8213U`.
- The prototype uses fake drivers, `Driver A` and `Driver B`, so driver availability is represented without inventing real staff data.
- Both drivers and vehicles are available from `06:30` until `15:00`.
- Every route starts and ends at Loving Heart Service Centre, postal code `600210`.
- Each vehicle can carry at most three patient–escort pairs simultaneously. A patient and their escort are treated as one capacity unit and travel together.
- Each vehicle is configured for at most eight patient services per day. One patient's outbound and return movement counts as one service for this daily limit.
- Vehicle and driver records are stored separately so real drivers, shifts or additional vehicles can replace the prototype defaults later.

### Outbound journey constraints

For each accepted appointment, the optimiser creates an outbound pickup and hospital drop-off pair.

- The pickup must occur before the hospital drop-off.
- Both stops must be assigned to the same vehicle.
- The patient must reach the destination no later than 15 minutes before the appointment.
- The earliest permitted arrival is 60 minutes before the appointment.
- Outbound journeys are mandatory. The optimiser may not drop an outbound journey to obtain a cheaper route.
- If no combination of the available vehicles can satisfy every outbound arrival window, optimisation fails with a visible no-feasible-route message instead of producing a late schedule.

### Return journey constraints

For each appointment, the optimiser also creates a hospital pickup and return drop-off pair.

- The return journey cannot begin before the appointment's estimated return-ready time.
- The target maximum wait after becoming ready is one hour.
- The patient and escort return together as one capacity unit.
- Return journeys are lower priority than every outbound journey.
- A return may remain unallocated when including it would make an outbound arrival infeasible. The schedule must surface the number of unallocated returns as a warning.
- When an escort calls to report that a patient is ready, the administrator updates the return-ready time on the appointment card and explicitly runs optimisation again.

### Optimisation objective

- The primary objective is to minimise total vehicle travel time across the day.
- Either or both vehicles may be activated. There is no requirement to fill the first vehicle before using the second; the second should be used whenever doing so reduces total travel time while respecting constraints.
- Travel time is the arc cost used by OR-Tools. Capacity, driver hours, daily service limits, stop precedence and appointment windows are hard constraints.
- Optional returns carry a lower-priority penalty so they are included when feasible but can never make a mandatory outbound journey late.
- The system currently solves one selected day at a time rather than optimising across multiple dates.

### Travel-time data

- Mapbox is the configured production travel-time provider. Appointment addresses are geocoded and sent through its driving Matrix API before OR-Tools runs.
- Matrix calls are split into blocks when a day contains more locations than one Mapbox matrix request supports.
- A Mapbox access token is required for road-based travel times and must remain in the backend environment, never browser code.
- Without a Mapbox token, the prototype uses deterministic local estimates and labels the result clearly as an estimate. Estimated results must not be treated as operational transport timings.
- An address that cannot be geocoded or routed produces a visible error rather than silently substituting another location.

### Human adjustment and reruns

- Every generated plan remains editable. Appointment modules support cross-vehicle dragging and reordering within the same lane.
- Up/down controls provide a non-drag alternative for reordering.
- Manual lane and order changes are persisted and survive a page refresh.
- Because a manual move invalidates calculated timing, planned times are cleared until a fresh optimisation is run.
- Selecting **Run again** intentionally creates a fresh optimised plan and may overwrite earlier manual lane or order choices.
- Removing an appointment requires an explicit warning confirmation and removes it from the active route plan.
- The system never silently finalises a vehicle or escort assignment on the administrator's behalf.

### Escort layer

- Vehicle allocation and escort matching remain independent services.
- A schedule card shows the assigned escort, **Escort needs matching**, or **No escort required**.
- An appointment needing an escort links to the existing matching workspace.
- Vehicle optimisation does not select or change escorts. Escort suggestions remain explainable and require the administrator's confirmation.

## Brand Commitments

The product name is KakiMETch. Its voice is calm, direct and supportive. It should feel familiar to an Excel-literate administrator without reproducing Excel's density or complexity.

## Evidence on Hand

- Three dummy Excel workbooks in `data/` cover 300 elderly records, September 2026 appointments and 20 synthetic escorts.
- `AGENTS.md` records user-discovery findings, operational boundaries and confirmed product decisions.
- There is no existing logo, visual identity or validated testimonial in the repository; future work must not invent them.

## Product Principles

- Automate administrative burden, never human judgment.
- Explain recommendations in plain language.
- Keep assessment, escort matching and driver scheduling as separate responsibilities.
- Make common work fast and exceptional decisions deliberate.
- Preserve trust through visible state, confirmation and auditable override reasons.

## Accessibility & Inclusion

The interface must support older, low-tech-confidence staff with comfortable type, high contrast, large targets, keyboard access, explicit labels and no hover-only or color-only meaning. Target WCAG 2.2 AA.
