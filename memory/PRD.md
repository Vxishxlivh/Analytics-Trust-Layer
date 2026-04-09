# TrustLayer - AI-Powered Report Validation Tool

## Architecture
- Frontend: React 19 + Tailwind CSS + Framer Motion + Shadcn/UI + React Router
- Backend: FastAPI + MongoDB + OpenAI gpt-4o-mini (emergentintegrations) + fpdf2
- Database: MongoDB

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
- Score rings with delta indicator (+33 green arrow)
- Summary stats with delta badges
- Claims listed side-by-side
- Analysis sections side-by-side

## Prioritized Backlog
### P1: Database connection, team sharing, batch validation
### P2: Dark/light toggle, keyboard shortcuts, email notifications
