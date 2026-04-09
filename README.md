# TrustLayer — AI Output Validation for Analysts

**The trust layer for AI-driven decision making.**

TrustLayer validates AI-generated reports against source data, catching wrong claims, logic gaps, and hidden assumptions before they reach decision-makers.

## What It Does

1. **Upload source data** (CSV, Excel, Google Sheets)
2. **Paste AI-generated analysis** (from ChatGPT, Copilot, internal LLMs)
3. **Get a Trust Report** — every claim verified, scored, and explained

Each claim gets: status, calibrated confidence score, pattern risk, difficulty rating, and full data lineage.

---

## Architecture (v2)

```
Report comes in
    |
    v
[Decompose] → atomic claims via GPT-4o-mini
    |
    v
[Canonicalize] → structured form: metric + direction + magnitude + time + entity
    |
    v
[Pattern Match] → TF-IDF cosine similarity against all past canonical claims
    |                assigns pattern_risk_score + similar_past_claims
    v
[Verify] → pandas code generated + executed against source data
    |        HIGH-risk claims: 3x self-consistency check (temps 0.1, 0.3, 0.5)
    |        NORMAL claims: single verification
    v
[Calibrate] → weighted confidence score:
    |           40% verification + 25% pattern history + 20% consistency + 15% difficulty
    v
[Index] → store in pattern_records + update pattern_graph
    |
    v
[Return] → trust score, claims with confidence, missing context, assumptions
```

## Key Features

### Claim Canonicalization
Raw text → structured form before matching. "Revenue dropped by 20%" and "1/5 decline in revenue" both become `{metric: "revenue", direction: "decrease", magnitude: "20%"}`. Makes pattern matching far more accurate.

### Confidence Calibration
No more binary verified/wrong. Each claim gets a 0-1 confidence score combining four signals: verification outcome, historical pattern risk, self-consistency across multiple runs, and claim difficulty. Output: "82% likely wrong" instead of just "wrong."

### Self-Consistency Verification
HIGH-risk claims are verified 3 times at different temperatures. If 2/3 agree → high confidence. If they diverge → flagged as "inconsistent." Catches the case where the validation LLM itself hallucinates.

### Pattern Intelligence
Every claim indexed with canonical form + fingerprint. Over time surfaces: which claim types AI fails on, what keywords correlate with errors, how HIGH-risk claims perform vs NORMAL. Grows smarter with every validation.

### Pattern Graph
Computable graph stored in MongoDB. Nodes = claim fingerprints (hash of metric + direction + magnitude bucket). Edges = outcomes. The game underneath: claim X arrives, traverses to pattern Y, records what happened. Network density = your moat.

### Pre-Scan Endpoint
Fast pattern-only risk assessment. No data verification, just historical matching. Returns predicted risk per claim in 1-2 seconds before the full 30-second validation runs.

### Active Learning
Users can submit feedback: "this verdict was actually correct/wrong." Feedback updates pattern records, making the system more accurate over time.

### User System
Signup with personal (student/analyst/other) or business (company email, auto-org detection). Business users with same email domain share an org-level pattern pool. Email collection for newsletters.

### Data Lineage
Every claim stores: which columns existed, how many rows, what code was generated, when verification ran. Full audit trail.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account (personal/business) |
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/upload-csv` | Upload CSV/Excel |
| POST | `/api/parse-csv-text` | Parse pasted CSV |
| POST | `/api/parse-google-sheet` | Fetch public Google Sheet |
| POST | `/api/validate` | Full validation pipeline |
| POST | `/api/pre-scan` | Fast pattern-only risk scan |
| POST | `/api/feedback` | Submit user feedback on claim |
| GET | `/api/validations` | List past validations |
| GET | `/api/validations/:id` | Get specific validation |
| DELETE | `/api/validations/:id` | Delete validation |
| POST | `/api/export-pdf` | Generate PDF report |
| GET | `/api/patterns` | Pattern intelligence dashboard |
| GET | `/api/patterns/claims` | Drill into pattern records |
| GET | `/api/patterns/graph` | Pattern graph data |
| GET | `/api/health` | Health check |

---

## Deploy to Railway

### Step 1: [railway.app](https://railway.app) → New Project → Deploy from GitHub
### Step 2: Add MongoDB (+ New → Database → MongoDB)
### Step 3: Set environment variables:
```
MONGO_URL=<from Railway MongoDB connect panel>
DB_NAME=trustlayer
JWT_SECRET=<generate a random 32+ char string>
CORS_ORIGINS=*
PORT=8000
```
### Step 4: Deploy. Share the URL with your analysts.

---

## Local Development

```bash
cd backend
pip install -r requirements.txt
# Create .env: MONGO_URL=mongodb://localhost:27017, DB_NAME=trustlayer, JWT_SECRET=dev-secret
uvicorn server:app --reload --port 8000
```

```bash
cd frontend
yarn install
# Create .env: REACT_APP_BACKEND_URL=http://localhost:8000
yarn start
```

---

## Tech Stack

- **Backend**: FastAPI, OpenAI GPT-4o-mini, Pandas, scikit-learn (TF-IDF), fpdf2, bcrypt, PyJWT
- **Frontend**: React 19, Tailwind CSS, Framer Motion, Shadcn/UI
- **Database**: MongoDB (validations + pattern_records + pattern_graph_nodes + pattern_graph_edges + users + orgs + feedback)
- **Deploy**: Railway (Docker)

## MongoDB Collections

| Collection | Purpose |
|-----------|---------|
| `users` | User accounts with role, org, email |
| `orgs` | Organizations grouped by email domain |
| `validations` | Full validation results |
| `pattern_records` | Individual claim outcomes for pattern matching |
| `pattern_graph_nodes` | Fingerprint nodes with outcome distributions |
| `pattern_graph_edges` | Fingerprint → outcome edges with timestamps |
| `feedback` | User feedback on claim correctness |
