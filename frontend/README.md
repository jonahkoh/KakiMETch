# KakiMETch frontend

This is the internal escort-matching workspace for Loving Heart staff. Accepted appointments appear as quiet patient modules; opening one reveals the patient’s matching needs and three explainable escort suggestions. The admin always selects and confirms the escort.

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`NEXT_PUBLIC_ASSESSMENT_API_URL`, `NEXT_PUBLIC_MATCHING_API_URL`, `NEXT_PUBLIC_REGISTRY_API_URL` and `NEXT_PUBLIC_SCHEDULING_API_URL` point to the four FastAPI services (defaults: ports 8001–8004). Browser code does not connect directly to Supabase in this slice.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The browser tests use mocked dummy records and run at desktop and mobile widths.

## Prototype boundary

This is a local/hackathon vertical slice with dummy data. Do not publicly deploy it with real client information until authentication, authorization, and audited data-access policies are in place. NRIC and escort contact details are intentionally absent from the interface and its safe API models.
