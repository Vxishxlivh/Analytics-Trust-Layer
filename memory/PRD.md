# TrustLayer - AI-Powered Report Validation Tool

## Problem Statement
Build a web application that validates AI-generated business reports against source data, decomposing claims and verifying them with pandas code execution.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Framer Motion + Shadcn/UI
- **Backend**: FastAPI + MongoDB + OpenAI gpt-4o-mini (via emergentintegrations)
- **Database**: MongoDB (validation history)

## User Personas
- VP/Director reviewing AI-generated reports before board meetings
- Data analysts validating report accuracy
- Business intelligence teams quality-checking automated reports

## Core Requirements
1. Data connection: CSV upload, paste CSV, Google Sheets URL, DB form
2. Analysis input: Paste AI-generated report text + OpenAI API key
3. Validation pipeline: Decompose claims → Generate verification code → Execute → Build report
4. Results dashboard: Trust score ring, risk badge, stat pills, claim cards, filters, analysis sections
5. Demo mode: 16 pre-built claims (7 wrong, 4 verified, 3 partial, 2 logic gaps)

## What's Been Implemented (Feb 2026)
- [x] Full backend API (upload-csv, parse-csv-text, validate, validations history)
- [x] OpenAI integration via emergentintegrations (gpt-4o-mini)
- [x] Pandas sandbox execution for claim verification
- [x] Complete frontend wizard flow (Data → Analysis → Loading → Results)
- [x] Animated trust score ring with color coding
- [x] Expandable claim cards with verification details
- [x] Filter tabs (All, Wrong, Verified, Partial, Logic Gaps, Unverifiable)
- [x] Analysis sections: Missing Context, Hidden Assumptions, Alternative Explanations
- [x] Demo mode with 16 realistic SaaS financial report claims
- [x] Dark theme Bloomberg-terminal aesthetic
- [x] JetBrains Mono + Instrument Sans typography

## Prioritized Backlog
### P0 (Critical)
- None remaining

### P1 (Important)
- Google Sheets URL integration (currently mocked)
- Database connection integration (currently mocked)
- Export validation report as PDF

### P2 (Nice to Have)
- Validation history page with past reports
- Team sharing/collaboration features
- Custom validation rules
- Batch report validation
- Email notification for completed validations

## Next Tasks
1. Add Google Sheets API integration
2. Implement PDF export of trust reports
3. Build validation history list/detail pages
4. Add team collaboration features
