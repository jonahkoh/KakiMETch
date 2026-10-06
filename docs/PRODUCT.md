# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

KakiMETch is an internal tool for Medical Transport service-provider administrators. Its primary user is Rose, Loving Heart's coordinator, who reviews referrals and matches accepted elderly clients with part-time escorts. Staff are generally in their 50s–60s, use Windows and Excel today, and need a workflow that is easy to scan without requiring high technical confidence.

## Product Purpose

KakiMETch reduces the manual effort and cognitive load involved in referral assessment and escort matching. Success means reducing administrative scheduling time by at least 50% while keeping the administrator in control of every decision.

## Positioning

The product turns informal matching knowledge—appointment availability, wheelchair-handling capability, dialect and gender preference—into visible, explainable suggestions. It proposes; the administrator always reviews and confirms.

## Operating Context

Loving Heart currently works from large Excel files, printed daily timetables and WhatsApp messages. Rose handles assessment and escort matching. Mr Tong separately assigns drivers, vehicles and routes. Appointments can change at short notice, and a typical day involves around six trips.

## Capabilities and Constraints

- Current milestone capabilities are internal assessment and top-K escort suggestions for accepted trips.
- Matching hard-filters escort availability, identical-time conflicts and required wheelchair capability, then soft-ranks dialect and gender preference.
- A no-viable-escort result is a warning, not a dead end; manual assignment requires an explicit override reason.
- NRIC must never appear in the interface.
- Driver/vehicle assignment, route optimization, finance, reporting, bulk Excel upload and caregiver-facing tools are outside the current matching slice.
- The MVP uses Next.js, FastAPI and Supabase Postgres. OR-Tools is explicitly deferred.
- The current build uses dummy data and is not approved for public deployment with real client information until authentication and authorization are added.

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
