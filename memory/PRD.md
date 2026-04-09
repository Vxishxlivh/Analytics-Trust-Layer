# TrustLayer - AI-Powered Report Validation Tool

## Problem Statement
Build a web application that validates AI-generated business reports against source data, decomposing claims and verifying them with pandas code execution.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Framer Motion + Shadcn/UI + React Router
- **Backend**: FastAPI + MongoDB + OpenAI gpt-4o-mini (via emergentintegrations) + fpdf2 for PDF
- **Database**: MongoDB (validation history)

## User Personas
- VP/Director reviewing AI-generated reports before board meetings
- Data analysts validating report accuracy
- Business intelligence teams quality-checking automated reports

## Core Requirements
1. Data connection: CSV upload, paste CSV, Google Sheets public URL, DB form
2. Analysis input: Paste AI-generated report text + OpenAI API key
3. Validation pipeline: Decompose claims -> Generate verification code -> Execute -> Build report
4. Results dashboard: Trust score ring, risk badge, stat pills, claim cards, filters, analysis sections
5. Demo mode: 16 pre-built claims (7 wrong, 4 verified, 3 partial, 2 logic gaps)
6. PDF export: Server-side PDF generation of trust reports
7. Validation history: Separate page with list, view, delete functionality
8. Google Sheets: Public URL parser for importing spreadsheet data

## What's Been Implemented (Feb 2026)
### Phase 1 - MVP
- [x] Full backend API (upload-csv, parse-csv-text, validate, validations history)
- [x] OpenAI integration via emergentintegrations (gpt-4o-mini)
- [x] Pandas sandbox execution for claim verification
- [x] Complete frontend wizard flow (Data -> Analysis -> Loading -> Results)
- [x] Animated trust score ring with color coding
- [x] Expandable claim cards with verification details
- [x] Filter tabs (All, Wrong, Verified, Partial, Logic Gaps, Unverifiable)
- [x] Analysis sections: Missing Context, Hidden Assumptions, Alternative Explanations
- [x] Demo mode with 16 realistic SaaS financial report claims
- [x] Dark theme Bloomberg-terminal aesthetic

### Phase 2 - Feature Additions (Feb 2026)
- [x] Google Sheets public URL parser (extracts sheet ID, downloads CSV export)
- [x] Server-side PDF export (fpdf2, includes all claims, stats, analysis sections)
- [x] Validation history page (/history route)
- [x] Single validation view from history
- [x] Delete validation from history
- [x] React Router navigation
- [x] Navbar with History link

## Prioritized Backlog
### P0 (Critical) - None remaining

### P1 (Important)
- Database connection integration (currently form-only mock)
- Comparison view: side-by-side two validation reports
- Custom validation rules

### P2 (Nice to Have)
- Team sharing/collaboration features
- Batch report validation
- Email notification for completed validations
- Dark/light theme toggle
- Keyboard shortcuts

## Next Tasks
1. Implement database connection integration
2. Add comparison view for multiple reports
3. Build team collaboration features
