# TrustLayer - AI-Powered Report Validation Tool

## Architecture
- Frontend: React 19 + Tailwind CSS + Framer Motion + Shadcn/UI + React Router
- Backend: FastAPI + MongoDB + OpenAI gpt-4o-mini (emergentintegrations) + fpdf2
- Database: MongoDB
- Auth: External JWT Auth via Railway API (https://analytics-trust-layer-production.up.railway.app)

## What's Been Implemented (Feb 2026)
### Phase 1 - MVP
- Full backend API (upload-csv, parse-csv-text, validate, validations)
- OpenAI integration for claim decomposition/verification
- 4-step wizard (Data -> Analysis -> Loading -> Results)
- Animated trust score ring, claim cards, filter tabs, analysis sections
- Demo mode with 16 SaaS financial report claims

### Phase 2 - Features
- Google Sheets public URL parser
- Server-side PDF export (fpdf2)
- Validation history page (/history)

### Phase 3 - Comparison View
- Split-screen comparison page (/compare)
- Access from History (checkbox selection A/B + Compare Selected button)
- Access from Results (Compare button -> selector dialog)
- Score rings with delta indicator
- Summary stats with delta badges
- Claims listed side-by-side
- Analysis sections side-by-side

### Phase 4 - Auth & Patterns (Feb 2026)
- Login page with email/password authentication
- Signup page with two-path flow (Personal Use / Business Use)
  - Personal: role (student/analyst/researcher/other), name, email, password
  - Business: company email (with org detection), role (analyst/data_scientist/manager/executive/other), name, password
- JWT token stored in localStorage, auto-attached to requests
- RequireAuth wrapper redirecting unauthenticated users to /login
- Patterns dashboard page (/patterns)
- All auth E2E tested (15/15 tests passed - iteration_4.json)

## Prioritized Backlog
### P1: Database connection form, team sharing, batch validation
### P2: Dark/light toggle, keyboard shortcuts, email notifications
