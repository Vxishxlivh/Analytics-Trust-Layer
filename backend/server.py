from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import json
import re
import traceback
import hashlib
import math
from pathlib import Path
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import pandas as pd
import numpy as np
import requests
from fpdf import FPDF
from openai import AsyncOpenAI
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'trustlayer')
JWT_SECRET = os.environ.get('JWT_SECRET', 'trustlayer-dev-secret-change-in-prod')
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[db_name]

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ===========================================================================
# HELPERS
# ===========================================================================

async def chat_completion(api_key: str, system_message: str, user_message: str, temperature: float = 0.2) -> str:
    client_oai = AsyncOpenAI(api_key=api_key)
    response = await client_oai.chat.completions.create(
        model="gpt-4o-mini",
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content.strip()


def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text


def execute_pandas_code(code: str, df: pd.DataFrame) -> Any:
    safe_builtins = {
        "len": len, "str": str, "int": int, "float": float, "round": round,
        "abs": abs, "sum": sum, "min": min, "max": max, "range": range,
        "enumerate": enumerate, "zip": zip, "sorted": sorted, "list": list,
        "dict": dict, "tuple": tuple, "set": set, "True": True, "False": False,
        "None": None, "print": print, "isinstance": isinstance, "type": type,
        "bool": bool, "map": map, "filter": filter,
    }
    namespace = {"pd": pd, "np": np, "df": df.copy(), "result": None}
    try:
        exec(code, {"__builtins__": safe_builtins}, namespace)
        return namespace.get("result")
    except Exception as e:
        return f"Execution error: {str(e)}"


def _extract_keywords(text: str) -> list:
    stop = {
        "the","a","an","is","are","was","were","be","been","being","have","has",
        "had","do","does","did","will","would","could","should","may","might",
        "shall","can","to","of","in","for","on","with","at","by","from","as",
        "into","through","during","before","after","above","below","between",
        "out","off","over","under","again","further","then","once","here",
        "there","when","where","why","how","all","each","every","both","few",
        "more","most","other","some","such","no","nor","not","only","own",
        "same","so","than","too","very","just","because","but","and","or","if",
        "while","about","up","its","it","this","that","these","those","their",
        "our","your","my","his","her","which","who","what","they","we","you",
        "he","she","per","also","based","total","over","last","year","quarter",
    }
    words = re.findall(r'[a-zA-Z]{3,}', text.lower())
    return list(set(w for w in words if w not in stop))[:20]


# ===========================================================================
# AUTH SYSTEM
# ===========================================================================

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def _get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Optional auth — returns user dict or None."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        return user
    except Exception:
        return None


@api_router.post("/auth/signup")
async def signup(data: dict):
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    use_type = data.get("use_type", "personal")  # "personal" or "business"
    role = data.get("role", "analyst")  # student, analyst, manager, executive, data_scientist, other
    company = data.get("company", "").strip()

    if not email or not password:
        raise HTTPException(400, "Email and password are required")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "Email already registered")

    # Detect org from email domain for business users
    domain = email.split("@")[1] if "@" in email else ""
    org_id = None
    if use_type == "business" and domain and domain not in ("gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "protonmail.com"):
        org = await db.orgs.find_one({"domain": domain})
        if org:
            org_id = org["id"]
        else:
            org_id = str(uuid.uuid4())
            await db.orgs.insert_one({
                "_id": org_id,
                "id": org_id,
                "domain": domain,
                "name": company or domain.split(".")[0].title(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "id": user_id,
        "email": email,
        "name": name,
        "password_hash": _hash_password(password),
        "use_type": use_type,
        "role": role,
        "company": company,
        "org_id": org_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)

    token = _create_token(user_id, email)
    return {
        "token": token,
        "user": {
            "id": user_id, "email": email, "name": name,
            "use_type": use_type, "role": role, "org_id": org_id,
        },
    }


@api_router.post("/auth/login")
async def login(data: dict):
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = await db.users.find_one({"email": email})
    if not user or not _verify_password(password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = _create_token(user["id"], email)
    return {
        "token": token,
        "user": {
            "id": user["id"], "email": user["email"], "name": user.get("name", ""),
            "use_type": user.get("use_type"), "role": user.get("role"),
            "org_id": user.get("org_id"),
        },
    }


@api_router.get("/auth/me")
async def get_me(user=Depends(_get_current_user)):
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


# ===========================================================================
# DATA INGESTION (unchanged)
# ===========================================================================

@api_router.get("/")
async def root():
    return {"message": "TrustLayer API v2"}


@api_router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename or "data.csv"
        if filename.endswith(('.xlsx', '.xls')):
            try:
                df = pd.read_excel(io.BytesIO(content))
            except Exception:
                df = pd.read_csv(io.BytesIO(content))
        else:
            try:
                df = pd.read_csv(io.BytesIO(content))
            except Exception:
                df = pd.read_excel(io.BytesIO(content))

        preview_rows = json.loads(df.head(5).to_json(orient='records', default_handler=str))
        all_rows = json.loads(df.to_json(orient='records', default_handler=str))
        return {
            "columns": list(df.columns),
            "preview_rows": preview_rows,
            "all_rows": all_rows,
            "total_rows": len(df),
        }
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {str(e)}")


@api_router.post("/parse-csv-text")
async def parse_csv_text(data: dict):
    try:
        csv_text = data.get("csv_text", "")
        df = pd.read_csv(io.StringIO(csv_text))
        preview_rows = json.loads(df.head(5).to_json(orient='records', default_handler=str))
        all_rows = json.loads(df.to_json(orient='records', default_handler=str))
        return {"columns": list(df.columns), "preview_rows": preview_rows, "all_rows": all_rows, "total_rows": len(df)}
    except Exception as e:
        raise HTTPException(400, f"Failed to parse CSV text: {str(e)}")


@api_router.post("/parse-google-sheet")
async def parse_google_sheet(data: dict):
    url = data.get("url", "").strip()
    if not url:
        raise HTTPException(400, "URL is required")
    patterns = [r'/spreadsheets/d/([a-zA-Z0-9-_]+)', r'key=([a-zA-Z0-9-_]+)']
    sheet_id = None
    for p in patterns:
        m = re.search(p, url)
        if m:
            sheet_id = m.group(1)
            break
    if not sheet_id:
        raise HTTPException(400, "Could not extract sheet ID")
    gid_match = re.search(r'gid=(\d+)', url)
    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid_match:
        export_url += f"&gid={gid_match.group(1)}"
    try:
        resp = requests.get(export_url, timeout=15)
        if resp.status_code != 200:
            raise HTTPException(400, "Failed to fetch sheet. Make sure it is publicly shared.")
        df = pd.read_csv(io.StringIO(resp.text))
        preview_rows = json.loads(df.head(5).to_json(orient='records', default_handler=str))
        all_rows = json.loads(df.to_json(orient='records', default_handler=str))
        return {"columns": list(df.columns), "preview_rows": preview_rows, "all_rows": all_rows, "total_rows": len(df)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Failed to parse Google Sheet: {str(e)}")


# ===========================================================================
# CLAIM CANONICALIZATION — structured extraction from raw claim text
# ===========================================================================

async def _canonicalize_claims(api_key: str, raw_claims: list) -> list:
    """Extract structured canonical form from each claim for better matching."""
    claims_text = "\n".join(f"{i+1}. {c['claim_text']}" for i, c in enumerate(raw_claims))

    canon_resp = await chat_completion(
        api_key=api_key,
        system_message=(
            "Extract structured canonical form from business claims. "
            "Return ONLY a JSON array, no markdown. Each element must have: "
            "metric (str, the core metric like 'revenue','churn','cac'), "
            "direction (str, one of 'increase','decrease','stable','unspecified'), "
            "magnitude (str, the numeric amount like '20%','$142K','3.8%', or 'unspecified'), "
            "time_period (str, like 'Q4','January','year-over-year', or 'unspecified'), "
            "entity (str, the subject like 'enterprise segment','overall','customers', or 'unspecified')."
        ),
        user_message=f"Extract canonical forms for these claims:\n{claims_text}",
    )
    try:
        canonicals = json.loads(strip_fences(canon_resp))
        for i, rc in enumerate(raw_claims):
            if i < len(canonicals):
                rc["canonical"] = canonicals[i]
            else:
                rc["canonical"] = {"metric": "unknown", "direction": "unspecified", "magnitude": "unspecified", "time_period": "unspecified", "entity": "unspecified"}
    except Exception:
        for rc in raw_claims:
            rc["canonical"] = {"metric": "unknown", "direction": "unspecified", "magnitude": "unspecified", "time_period": "unspecified", "entity": "unspecified"}
    return raw_claims


def _claim_fingerprint(canonical: dict) -> str:
    """Compute a deterministic fingerprint from canonical form for graph matching."""
    parts = [
        canonical.get("metric", "unknown").lower().strip(),
        canonical.get("direction", "unspecified").lower().strip(),
        _magnitude_bucket(canonical.get("magnitude", "unspecified")),
    ]
    raw = "|".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _magnitude_bucket(mag: str) -> str:
    """Bucket magnitude into ranges for fingerprint grouping."""
    nums = re.findall(r'[\d.]+', str(mag))
    if not nums:
        return "unspecified"
    val = float(nums[0])
    if val < 5:
        return "small_0-5"
    elif val < 15:
        return "medium_5-15"
    elif val < 30:
        return "large_15-30"
    elif val < 50:
        return "xlarge_30-50"
    else:
        return "massive_50+"


def _canonical_text(canonical: dict) -> str:
    """Convert canonical form to searchable text for TF-IDF matching."""
    parts = [
        canonical.get("metric", ""),
        canonical.get("direction", ""),
        canonical.get("magnitude", ""),
        canonical.get("time_period", ""),
        canonical.get("entity", ""),
    ]
    return " ".join(p for p in parts if p and p != "unspecified")


# ===========================================================================
# CLAIM DIFFICULTY SCORING
# ===========================================================================

def _score_difficulty(claim_text: str, claim_type: str, canonical: dict) -> float:
    """Score claim difficulty 0.0 (easy) to 1.0 (hard). Higher = harder to verify."""
    score = 0.0

    # Type-based difficulty
    type_weights = {
        "numeric_fact": 0.2,
        "comparison": 0.4,
        "causal_argument": 0.7,
        "projection": 0.8,
        "recommendation": 0.6,
    }
    score += type_weights.get(claim_type, 0.5)

    # Multi-variable claims are harder
    metric = canonical.get("metric", "")
    if any(w in claim_text.lower() for w in ["and", "while", "whereas", "but", "however"]):
        score += 0.15

    # Derived / percentage claims are harder than absolutes
    mag = canonical.get("magnitude", "")
    if "%" in str(mag):
        score += 0.1

    # Ambiguous wording
    if any(w in claim_text.lower() for w in ["roughly", "approximately", "about", "around", "nearly", "estimated"]):
        score += 0.1

    return min(round(score, 2), 1.0)


# ===========================================================================
# PATTERN MATCHING ENGINE — TF-IDF on canonical forms
# ===========================================================================

async def _match_patterns(claims: list) -> list:
    """For each claim, find similar past claims and compute pattern_risk_score."""
    past_records = await db.pattern_records.find(
        {}, {"_id": 0, "claim_text": 1, "canonical_text": 1, "status": 1,
             "claim_type": 1, "fingerprint": 1, "canonical": 1}
    ).to_list(5000)

    if len(past_records) < 3:
        # Not enough data for meaningful matching
        for c in claims:
            c["pattern_risk_score"] = None
            c["pattern_match_count"] = 0
            c["similar_past_claims"] = []
        return claims

    # Build TF-IDF matrix from past canonical texts
    past_texts = [r.get("canonical_text", r.get("claim_text", "")) for r in past_records]
    vectorizer = TfidfVectorizer(stop_words='english', max_features=500)

    try:
        tfidf_matrix = vectorizer.fit_transform(past_texts)
    except ValueError:
        for c in claims:
            c["pattern_risk_score"] = None
            c["pattern_match_count"] = 0
            c["similar_past_claims"] = []
        return claims

    for claim in claims:
        query_text = claim.get("canonical_text", claim.get("claim_text", ""))
        try:
            query_vec = vectorizer.transform([query_text])
            similarities = cosine_similarity(query_vec, tfidf_matrix).flatten()
        except Exception:
            claim["pattern_risk_score"] = None
            claim["pattern_match_count"] = 0
            claim["similar_past_claims"] = []
            continue

        # Get top 5 most similar past claims (threshold > 0.15)
        top_indices = similarities.argsort()[::-1]
        similar = []
        for idx in top_indices:
            if len(similar) >= 5:
                break
            sim_score = float(similarities[idx])
            if sim_score < 0.15:
                break
            rec = past_records[idx]
            similar.append({
                "claim_text": rec.get("claim_text", ""),
                "status": rec.get("status", ""),
                "similarity": round(sim_score, 3),
                "claim_type": rec.get("claim_type", ""),
            })

        # Calculate pattern risk: weighted proportion of wrong in similar claims
        if similar:
            wrong_count = sum(1 for s in similar if s["status"] == "wrong")
            weighted_wrong = sum(
                s["similarity"] * (1.0 if s["status"] == "wrong" else 0.0)
                for s in similar
            )
            weighted_total = sum(s["similarity"] for s in similar)
            pattern_risk = round(weighted_wrong / max(weighted_total, 0.001), 3)
        else:
            pattern_risk = None

        claim["pattern_risk_score"] = pattern_risk
        claim["pattern_match_count"] = len(similar)
        claim["similar_past_claims"] = similar[:3]  # return top 3 to frontend

    return claims


# ===========================================================================
# SELF-CONSISTENCY CHECK — 3x sampling for high-risk claims
# ===========================================================================

async def _self_consistency_verify(api_key: str, claim_text: str, cols_info: str, df: pd.DataFrame) -> dict:
    """Run verification 3 times at different temperatures, flag divergence."""
    temperatures = [0.1, 0.3, 0.5]
    results = []
    codes = []

    for temp in temperatures:
        try:
            code_resp = await chat_completion(
                api_key=api_key,
                system_message=(
                    "Generate pandas code to verify a claim. Return ONLY Python code, no markdown. "
                    "The DataFrame is `df`. Store your answer in `result` as a dict with keys: "
                    "claimed_value (str), actual_value (str), matches (bool), explanation (str)."
                ),
                user_message=f"Verify this claim: {claim_text}\n\nData:\n{cols_info}",
                temperature=temp,
            )
            code = strip_fences(code_resp)
            codes.append(code)
            exec_result = execute_pandas_code(code, df)
            if isinstance(exec_result, dict):
                results.append(exec_result)
            else:
                results.append(None)
        except Exception:
            results.append(None)

    # Analyze consistency
    valid_results = [r for r in results if r is not None]
    if not valid_results:
        return {
            "status": "unverifiable",
            "claimed_value": None,
            "actual_value": None,
            "explanation": "All verification attempts failed",
            "verification_code": codes[0] if codes else None,
            "consistency_score": 0.0,
            "consistency_detail": "all_failed",
        }

    # Check if all agree on matches
    verdicts = [r.get("matches") for r in valid_results]
    agree_count = max(verdicts.count(True), verdicts.count(False))
    consistency = round(agree_count / len(verdicts), 2)

    # Use majority verdict
    majority_matches = verdicts.count(True) > verdicts.count(False)
    best = valid_results[0]  # use first valid result for values

    status = "verified" if majority_matches else "wrong"
    if consistency < 0.67:
        status = "inconsistent"

    return {
        "status": status,
        "claimed_value": str(best.get("claimed_value", "N/A")),
        "actual_value": str(best.get("actual_value", "N/A")),
        "explanation": best.get("explanation", ""),
        "verification_code": codes[0] if codes else None,
        "consistency_score": consistency,
        "consistency_detail": f"{agree_count}/{len(verdicts)} runs agreed",
    }


# ===========================================================================
# CONFIDENCE CALIBRATION — weighted composite score
# ===========================================================================

def _calibrate_confidence(claim: dict) -> dict:
    """Compute calibrated confidence score combining multiple signals."""
    w_verification = 0.40
    w_pattern = 0.25
    w_consistency = 0.20
    w_difficulty = 0.15

    # Verification signal (0-1, 1 = verified, 0 = wrong)
    status_scores = {
        "verified": 1.0, "wrong": 0.0, "partial": 0.5,
        "logic_gap": 0.3, "unverifiable": 0.4, "inconsistent": 0.25,
    }
    v_score = status_scores.get(claim.get("status"), 0.4)

    # Pattern risk signal (inverted: low risk = high confidence)
    pattern_risk = claim.get("pattern_risk_score")
    p_score = 1.0 - pattern_risk if pattern_risk is not None else 0.5

    # Consistency signal
    c_score = claim.get("consistency_score", 0.5)

    # Difficulty signal (inverted: easy claims = higher confidence in result)
    difficulty = claim.get("difficulty_score", 0.5)
    d_score = 1.0 - (difficulty * 0.5)  # difficulty dampens but doesn't dominate

    raw = (w_verification * v_score + w_pattern * p_score +
           w_consistency * c_score + w_difficulty * d_score)

    confidence = round(min(max(raw, 0.0), 1.0), 3)

    # Generate verdict
    if confidence >= 0.8:
        verdict = "high confidence"
    elif confidence >= 0.6:
        verdict = "moderate confidence"
    elif confidence >= 0.4:
        verdict = "low confidence"
    else:
        verdict = "likely wrong"

    claim["confidence_score"] = confidence
    claim["confidence_verdict"] = verdict
    claim["confidence_breakdown"] = {
        "verification": round(v_score, 2),
        "pattern_history": round(p_score, 2),
        "consistency": round(c_score, 2),
        "difficulty_factor": round(d_score, 2),
    }
    return claim


# ===========================================================================
# CORE VALIDATION ENDPOINT — enhanced pipeline
# ===========================================================================

@api_router.post("/validate")
async def validate_analysis(data: dict, user=Depends(_get_current_user)):
    csv_data = data.get("csv_data", [])
    analysis_text = data.get("analysis_text", "")
    api_key = data.get("api_key", "")

    if not csv_data or not analysis_text or not api_key:
        raise HTTPException(400, "csv_data, analysis_text, and api_key are required")

    try:
        df = pd.DataFrame(csv_data)
        cols_info = (
            f"Columns: {list(df.columns)}\n"
            f"Shape: {df.shape}\n"
            f"Dtypes:\n{df.dtypes.to_string()}\n"
            f"Sample (first 3 rows):\n{df.head(3).to_string()}"
        )

        # === STEP 1: Decompose claims ===
        decompose_msg = f"""Decompose this analysis into atomic claims (one fact per claim).

DATA CONTEXT:
{cols_info}

ANALYSIS:
{analysis_text}

Return a JSON array. Each element must have:
- "claim_text": the exact claim from the analysis
- "claim_type": one of ["numeric_fact","causal_argument","comparison","projection","recommendation"]
- "risk_level": "HIGH" if the claim significantly affects business decisions, else "NORMAL"
- "verifiable": true if checkable against the data columns, else false

Return ONLY the JSON array, no explanation."""

        resp = await chat_completion(
            api_key=api_key,
            system_message="You decompose business analyses into atomic claims for data validation. Respond with valid JSON only, no markdown fences.",
            user_message=decompose_msg,
        )
        raw_claims = json.loads(strip_fences(resp))

        # === STEP 2: Canonicalize claims (NEW) ===
        raw_claims = await _canonicalize_claims(api_key, raw_claims)

        # === STEP 3: Verify each claim ===
        claims = []
        for rc in raw_claims:
            canonical = rc.get("canonical", {})
            fingerprint = _claim_fingerprint(canonical)
            canonical_text = _canonical_text(canonical)
            difficulty = _score_difficulty(rc["claim_text"], rc["claim_type"], canonical)

            claim = {
                "id": str(uuid.uuid4()),
                "claim_text": rc["claim_text"],
                "claim_type": rc["claim_type"],
                "risk_level": rc.get("risk_level", "NORMAL"),
                "canonical": canonical,
                "fingerprint": fingerprint,
                "canonical_text": canonical_text,
                "difficulty_score": difficulty,
                "claimed_value": None,
                "actual_value": None,
                "explanation": "",
                "verification_code": None,
                "status": "unverifiable",
                "consistency_score": None,
                "consistency_detail": None,
                # Data lineage fields
                "data_columns_used": list(df.columns),
                "data_rows_count": len(df),
                "verification_timestamp": datetime.now(timezone.utc).isoformat(),
            }

            if rc.get("verifiable") and rc["claim_type"] in ["numeric_fact", "comparison"]:
                # Use self-consistency for HIGH risk claims
                if rc.get("risk_level") == "HIGH":
                    sc_result = await _self_consistency_verify(api_key, rc["claim_text"], cols_info, df)
                    claim["status"] = sc_result["status"]
                    claim["claimed_value"] = sc_result["claimed_value"]
                    claim["actual_value"] = sc_result["actual_value"]
                    claim["explanation"] = sc_result["explanation"]
                    claim["verification_code"] = sc_result["verification_code"]
                    claim["consistency_score"] = sc_result["consistency_score"]
                    claim["consistency_detail"] = sc_result["consistency_detail"]
                else:
                    # Single verification for NORMAL risk
                    code_resp = await chat_completion(
                        api_key=api_key,
                        system_message=(
                            "Generate pandas code to verify a claim. Return ONLY Python code, no markdown. "
                            "The DataFrame is `df`. Store your answer in `result` as a dict with keys: "
                            "claimed_value (str), actual_value (str), matches (bool), explanation (str)."
                        ),
                        user_message=f"Verify this claim: {rc['claim_text']}\n\nData:\n{cols_info}",
                    )
                    code = strip_fences(code_resp)
                    claim["verification_code"] = code
                    exec_result = execute_pandas_code(code, df)
                    if isinstance(exec_result, dict):
                        claim["claimed_value"] = str(exec_result.get("claimed_value", "N/A"))
                        claim["actual_value"] = str(exec_result.get("actual_value", "N/A"))
                        claim["explanation"] = exec_result.get("explanation", "")
                        claim["status"] = "verified" if exec_result.get("matches") else "wrong"
                        claim["consistency_score"] = 1.0
                        claim["consistency_detail"] = "single_run"
                    else:
                        claim["status"] = "unverifiable"
                        claim["explanation"] = str(exec_result) if exec_result else "Verification failed"

            elif rc["claim_type"] == "causal_argument":
                claim["status"] = "logic_gap"
                claim["explanation"] = "Causal claim requires evidence beyond data correlation."
            elif rc["claim_type"] == "projection":
                claim["status"] = "partial"
                claim["explanation"] = "Projection based on assumptions that may not hold."
            elif rc["claim_type"] == "recommendation":
                claim["status"] = "unverifiable"
                claim["explanation"] = "Recommendations cannot be verified against historical data."

            claims.append(claim)

        # === STEP 4: Pattern matching against history (NEW) ===
        claims = await _match_patterns(claims)

        # === STEP 5: Confidence calibration (NEW) ===
        claims = [_calibrate_confidence(c) for c in claims]

        # === STEP 6: Missing context analysis ===
        m_resp = await chat_completion(
            api_key=api_key,
            system_message="Analyze for missing context in business analysis. Return valid JSON only, no markdown fences.",
            user_message=f"""Given this data and analysis, identify gaps.
DATA: {cols_info}
ANALYSIS: {analysis_text}

Return JSON object with keys:
- "missing_context": array of things the analysis should mention but doesn't
- "hidden_assumptions": array of assumptions baked into the analysis
- "alternative_explanations": array of alternative interpretations""",
        )
        missing = json.loads(strip_fences(m_resp))

        # === STEP 7: Calculate trust score ===
        summary = {
            "verified": sum(1 for c in claims if c["status"] == "verified"),
            "wrong": sum(1 for c in claims if c["status"] == "wrong"),
            "partial": sum(1 for c in claims if c["status"] == "partial"),
            "logic_gap": sum(1 for c in claims if c["status"] == "logic_gap"),
            "unverifiable": sum(1 for c in claims if c["status"] == "unverifiable"),
            "inconsistent": sum(1 for c in claims if c["status"] == "inconsistent"),
        }
        total = len(claims)
        score = int(((summary["verified"] + summary["partial"] * 0.5) / max(total, 1)) * 100)

        # Adjust score by average confidence
        avg_confidence = sum(c.get("confidence_score", 0.5) for c in claims) / max(total, 1)
        score = int(score * (0.7 + 0.3 * avg_confidence))  # confidence modulates score ±30%

        risk = "LOW" if score >= 75 else "MEDIUM" if score >= 50 else "HIGH" if score >= 25 else "CRITICAL"

        result = {
            "id": str(uuid.uuid4()),
            "trust_score": score,
            "decision_risk": risk,
            "claims": claims,
            "missing_context": missing.get("missing_context", []),
            "hidden_assumptions": missing.get("hidden_assumptions", []),
            "alternative_explanations": missing.get("alternative_explanations", []),
            "summary": summary,
            "avg_confidence": round(avg_confidence, 3),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_demo": False,
            "user_id": user["id"] if user else None,
            "org_id": user.get("org_id") if user else None,
        }

        # Store validation
        await db.validations.insert_one({**result, "_id": str(uuid.uuid4())})

        # Index claims for pattern intelligence
        await _index_claims_for_patterns(claims)

        # Update pattern graph
        await _update_pattern_graph(claims)

        return result

    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        logger.error(f"Validation error: {traceback.format_exc()}")
        raise HTTPException(500, str(e))


# ===========================================================================
# PRE-SCAN ENDPOINT — fast pattern-only risk assessment (NEW)
# ===========================================================================

@api_router.post("/pre-scan")
async def pre_scan(data: dict):
    """Fast pattern-only risk assessment — no data verification, no LLM calls for checking.
    Returns predicted risk per claim based on historical patterns."""
    analysis_text = data.get("analysis_text", "")
    api_key = data.get("api_key", "")

    if not analysis_text or not api_key:
        raise HTTPException(400, "analysis_text and api_key required")

    # Decompose + canonicalize
    decompose_msg = f"""Decompose this analysis into atomic claims (one fact per claim).
ANALYSIS:
{analysis_text}

Return a JSON array. Each element must have:
- "claim_text": the exact claim
- "claim_type": one of ["numeric_fact","causal_argument","comparison","projection","recommendation"]
- "risk_level": "HIGH" or "NORMAL"
- "verifiable": true/false

Return ONLY the JSON array."""

    resp = await chat_completion(
        api_key=api_key,
        system_message="Decompose business analyses into atomic claims. Respond with valid JSON only.",
        user_message=decompose_msg,
    )
    raw_claims = json.loads(strip_fences(resp))
    raw_claims = await _canonicalize_claims(api_key, raw_claims)

    # Build claim structures
    scan_claims = []
    for rc in raw_claims:
        canonical = rc.get("canonical", {})
        scan_claims.append({
            "claim_text": rc["claim_text"],
            "claim_type": rc["claim_type"],
            "risk_level": rc.get("risk_level", "NORMAL"),
            "canonical": canonical,
            "canonical_text": _canonical_text(canonical),
            "fingerprint": _claim_fingerprint(canonical),
            "difficulty_score": _score_difficulty(rc["claim_text"], rc["claim_type"], canonical),
        })

    # Run pattern matching only (no verification)
    scan_claims = await _match_patterns(scan_claims)

    # Flag high-risk claims
    flagged = []
    for c in scan_claims:
        risk = c.get("pattern_risk_score")
        flagged.append({
            "claim_text": c["claim_text"],
            "claim_type": c["claim_type"],
            "pattern_risk_score": risk,
            "pattern_match_count": c.get("pattern_match_count", 0),
            "difficulty_score": c["difficulty_score"],
            "predicted_status": "likely_wrong" if risk and risk > 0.6 else "likely_ok" if risk and risk < 0.3 else "uncertain",
            "similar_past_claims": c.get("similar_past_claims", []),
        })

    return {
        "total_claims": len(flagged),
        "high_risk_count": sum(1 for f in flagged if f["predicted_status"] == "likely_wrong"),
        "claims": flagged,
    }


# ===========================================================================
# PATTERN INDEXING & GRAPH
# ===========================================================================

async def _index_claims_for_patterns(claims: list):
    records = []
    now = datetime.now(timezone.utc).isoformat()
    for c in claims:
        records.append({
            "_id": str(uuid.uuid4()),
            "claim_id": c["id"],
            "claim_text": c["claim_text"],
            "claim_type": c["claim_type"],
            "status": c["status"],
            "risk_level": c.get("risk_level", "NORMAL"),
            "claimed_value": c.get("claimed_value"),
            "actual_value": c.get("actual_value"),
            "explanation": c.get("explanation", ""),
            "canonical": c.get("canonical", {}),
            "canonical_text": c.get("canonical_text", ""),
            "fingerprint": c.get("fingerprint", ""),
            "difficulty_score": c.get("difficulty_score", 0.5),
            "confidence_score": c.get("confidence_score"),
            "consistency_score": c.get("consistency_score"),
            "keywords": _extract_keywords(c["claim_text"]),
            "indexed_at": now,
        })
    if records:
        await db.pattern_records.insert_many(records)


async def _update_pattern_graph(claims: list):
    """Update the pattern graph — nodes are fingerprints, edges are outcomes.
    This is the 'game underneath': claim X arrives, traverses to pattern Y,
    records the outcome, and the network grows."""
    for c in claims:
        fp = c.get("fingerprint", "")
        if not fp:
            continue

        status = c.get("status", "unverifiable")
        canonical = c.get("canonical", {})

        # Upsert node (fingerprint)
        await db.pattern_graph_nodes.update_one(
            {"fingerprint": fp},
            {
                "$set": {
                    "fingerprint": fp,
                    "canonical_sample": canonical,
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                },
                "$inc": {
                    f"outcomes.{status}": 1,
                    "total_hits": 1,
                },
                "$setOnInsert": {
                    "_id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            },
            upsert=True,
        )

        # Add edge: fingerprint → status outcome
        await db.pattern_graph_edges.insert_one({
            "_id": str(uuid.uuid4()),
            "from_fingerprint": fp,
            "to_status": status,
            "claim_type": c.get("claim_type"),
            "confidence_score": c.get("confidence_score"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })


# ===========================================================================
# ACTIVE LEARNING — user feedback on claim correctness (NEW)
# ===========================================================================

@api_router.post("/feedback")
async def submit_feedback(data: dict, user=Depends(_get_current_user)):
    """User tells us if a claim verdict was actually correct or not.
    This is the active learning loop — human labels improve pattern data."""
    claim_id = data.get("claim_id", "")
    user_verdict = data.get("user_verdict", "")  # "correct", "wrong", "unsure"
    comment = data.get("comment", "")

    if not claim_id or user_verdict not in ("correct", "wrong", "unsure"):
        raise HTTPException(400, "claim_id and user_verdict (correct/wrong/unsure) required")

    # Store feedback
    await db.feedback.insert_one({
        "_id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_verdict": user_verdict,
        "comment": comment,
        "user_id": user["id"] if user else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # If user says our system was wrong, update the pattern record
    if user_verdict in ("correct", "wrong"):
        pattern_record = await db.pattern_records.find_one({"claim_id": claim_id})
        if pattern_record:
            # If user says "wrong" and we said "verified", our system got it wrong
            # If user says "correct" and we said "wrong", our system also got it wrong
            system_status = pattern_record.get("status", "")
            system_was_right = (
                (user_verdict == "correct" and system_status == "verified") or
                (user_verdict == "wrong" and system_status == "wrong")
            )

            await db.pattern_records.update_one(
                {"claim_id": claim_id},
                {"$set": {
                    "user_feedback": user_verdict,
                    "system_was_right": system_was_right,
                    "feedback_at": datetime.now(timezone.utc).isoformat(),
                }}
            )

    return {"status": "feedback_recorded", "claim_id": claim_id}


# ===========================================================================
# VALIDATION HISTORY
# ===========================================================================

@api_router.get("/validations")
async def get_validations(user=Depends(_get_current_user)):
    query = {}
    if user:
        query["user_id"] = user["id"]
    validations = await db.validations.find(
        query, {"_id": 0, "claims": 0, "missing_context": 0, "hidden_assumptions": 0, "alternative_explanations": 0}
    ).sort("timestamp", -1).to_list(100)
    return validations


@api_router.get("/validations/{validation_id}")
async def get_validation(validation_id: str):
    doc = await db.validations.find_one({"id": validation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Validation not found")
    return doc


@api_router.delete("/validations/{validation_id}")
async def delete_validation(validation_id: str):
    result = await db.validations.delete_one({"id": validation_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Validation not found")
    return {"deleted": True}


# ===========================================================================
# PATTERN INTELLIGENCE DASHBOARD
# ===========================================================================

@api_router.get("/patterns")
async def get_patterns():
    total = await db.pattern_records.count_documents({})
    if total == 0:
        return {
            "total_claims": 0, "status_distribution": {}, "type_accuracy": {},
            "ai_failure_patterns": [], "human_error_patterns": [], "risk_accuracy": {},
            "trend": [], "top_wrong_keywords": [], "top_verified_keywords": [],
            "insights": ["No validations recorded yet. Run a few reports to see patterns emerge."],
            "graph_stats": {"nodes": 0, "edges": 0},
        }

    # Status distribution
    status_dist = {}
    async for doc in db.pattern_records.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]):
        status_dist[doc["_id"]] = doc["count"]

    # Type accuracy
    type_raw = {}
    async for doc in db.pattern_records.aggregate([{"$group": {"_id": {"type": "$claim_type", "status": "$status"}, "count": {"$sum": 1}}}]):
        ct, st = doc["_id"]["type"], doc["_id"]["status"]
        type_raw.setdefault(ct, {})[st] = doc["count"]

    type_accuracy = {}
    for ct, statuses in type_raw.items():
        t = sum(statuses.values())
        v, w = statuses.get("verified", 0), statuses.get("wrong", 0)
        type_accuracy[ct] = {
            "total": t, "verified": v, "wrong": w,
            "partial": statuses.get("partial", 0), "logic_gap": statuses.get("logic_gap", 0),
            "unverifiable": statuses.get("unverifiable", 0), "inconsistent": statuses.get("inconsistent", 0),
            "accuracy_pct": round(v / max(t, 1) * 100, 1),
            "failure_pct": round(w / max(t, 1) * 100, 1),
        }

    # Risk accuracy
    risk_raw = {}
    async for doc in db.pattern_records.aggregate([{"$group": {"_id": {"risk": "$risk_level", "status": "$status"}, "count": {"$sum": 1}}}]):
        rl, st = doc["_id"]["risk"], doc["_id"]["status"]
        risk_raw.setdefault(rl, {})[st] = doc["count"]
    risk_accuracy = {}
    for rl, statuses in risk_raw.items():
        t = sum(statuses.values())
        w = statuses.get("wrong", 0)
        risk_accuracy[rl] = {"total": t, "wrong": w, "wrong_pct": round(w / max(t, 1) * 100, 1)}

    # Keywords
    top_wrong_kw = []
    async for doc in db.pattern_records.aggregate([{"$match": {"status": "wrong"}}, {"$unwind": "$keywords"}, {"$group": {"_id": "$keywords", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 15}]):
        top_wrong_kw.append({"keyword": doc["_id"], "count": doc["count"]})
    top_verified_kw = []
    async for doc in db.pattern_records.aggregate([{"$match": {"status": "verified"}}, {"$unwind": "$keywords"}, {"$group": {"_id": "$keywords", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 15}]):
        top_verified_kw.append({"keyword": doc["_id"], "count": doc["count"]})

    # Failure patterns
    ai_failure_patterns = sorted(
        [{"claim_type": ct, "failure_pct": info["failure_pct"], "total": info["total"]}
         for ct, info in type_accuracy.items() if info["total"] >= 2],
        key=lambda x: x["failure_pct"], reverse=True,
    )
    human_error_patterns = sorted(
        [{"claim_type": ct, "unverifiable_or_gap": info["unverifiable"] + info["logic_gap"], "total": info["total"]}
         for ct, info in type_accuracy.items() if info["total"] >= 2],
        key=lambda x: x["unverifiable_or_gap"], reverse=True,
    )

    # Trend
    trend = []
    async for doc in db.validations.find({}, {"_id": 0, "trust_score": 1, "timestamp": 1, "decision_risk": 1, "avg_confidence": 1}).sort("timestamp", -1).limit(20):
        trend.append(doc)
    trend.reverse()

    # Graph stats
    node_count = await db.pattern_graph_nodes.count_documents({})
    edge_count = await db.pattern_graph_edges.count_documents({})

    # Insights
    insights = _generate_insights(total, status_dist, type_accuracy, risk_accuracy, top_wrong_kw)

    return {
        "total_claims": total, "status_distribution": status_dist, "type_accuracy": type_accuracy,
        "ai_failure_patterns": ai_failure_patterns, "human_error_patterns": human_error_patterns,
        "risk_accuracy": risk_accuracy, "trend": trend,
        "top_wrong_keywords": top_wrong_kw, "top_verified_keywords": top_verified_kw,
        "insights": insights,
        "graph_stats": {"nodes": node_count, "edges": edge_count},
    }


def _generate_insights(total, status_dist, type_accuracy, risk_accuracy, top_wrong_kw) -> list:
    insights = []
    verified = status_dist.get("verified", 0)
    wrong = status_dist.get("wrong", 0)
    inconsistent = status_dist.get("inconsistent", 0)

    insights.append(
        f"Across {total} claims validated, {round(verified/max(total,1)*100,1)}% verified correct, "
        f"{round(wrong/max(total,1)*100,1)}% wrong, {round(inconsistent/max(total,1)*100,1)}% inconsistent."
    )

    if type_accuracy:
        worst = max(type_accuracy.items(), key=lambda x: x[1]["failure_pct"])
        if worst[1]["failure_pct"] > 0 and worst[1]["total"] >= 2:
            insights.append(f"AI is most unreliable on '{worst[0].replace('_',' ')}' claims — {worst[1]['failure_pct']}% failure rate.")
        best = min(type_accuracy.items(), key=lambda x: x[1]["failure_pct"])
        if best[1]["total"] >= 2 and best[0] != worst[0]:
            insights.append(f"AI is most reliable on '{best[0].replace('_',' ')}' claims — only {best[1]['failure_pct']}% failure rate.")

    high_risk = risk_accuracy.get("HIGH", {})
    normal_risk = risk_accuracy.get("NORMAL", {})
    if high_risk.get("total", 0) >= 2 and normal_risk.get("total", 0) >= 2:
        insights.append(f"HIGH-risk claims fail {high_risk.get('wrong_pct',0)}% vs {normal_risk.get('wrong_pct',0)}% for NORMAL-risk.")

    if top_wrong_kw:
        insights.append(f"Terms most associated with wrong claims: {', '.join(k['keyword'] for k in top_wrong_kw[:5])}.")

    # Feedback insights
    feedback_count = 0
    # We'd query feedback collection here in production
    if not insights:
        insights.append("Not enough data yet. Run more validations to surface patterns.")
    return insights


@api_router.get("/patterns/claims")
async def get_pattern_claims(status: Optional[str] = None, claim_type: Optional[str] = None, limit: int = 50):
    query = {}
    if status:
        query["status"] = status
    if claim_type:
        query["claim_type"] = claim_type
    docs = await db.pattern_records.find(query, {"_id": 0}).sort("indexed_at", -1).limit(limit).to_list(limit)
    return docs


@api_router.get("/patterns/graph")
async def get_pattern_graph(limit: int = 50):
    """Return pattern graph data for visualization."""
    nodes = await db.pattern_graph_nodes.find({}, {"_id": 0}).sort("total_hits", -1).limit(limit).to_list(limit)
    edges = await db.pattern_graph_edges.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit * 3).to_list(limit * 3)
    return {"nodes": nodes, "edges": edges}


# ===========================================================================
# PDF EXPORT (unchanged logic, added confidence fields)
# ===========================================================================

STATUS_LABELS = {
    "verified": "VERIFIED", "wrong": "WRONG", "partial": "PARTIAL",
    "logic_gap": "LOGIC GAP", "unverifiable": "UNVERIFIABLE", "inconsistent": "INCONSISTENT",
}


class TrustLayerPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, "[TRUST_LAYER] VALIDATION REPORT", align="L")
        self.ln(12)
        self.set_draw_color(30, 41, 59)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(100, 116, 139)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}  |  Generated by TrustLayer", align="C")


def _safe_text(text):
    if not text:
        return ""
    return text.encode("latin-1", "replace").decode("latin-1")


@api_router.post("/export-pdf")
async def export_pdf(data: dict):
    try:
        pdf = TrustLayerPDF()
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=20)
        pdf.add_page()

        trust_score = data.get("trust_score", 0)
        decision_risk = data.get("decision_risk", "N/A")
        summary = data.get("summary", {})
        claims = data.get("claims", [])
        missing = data.get("missing_context", [])
        assumptions = data.get("hidden_assumptions", [])
        alternatives = data.get("alternative_explanations", [])
        timestamp = data.get("timestamp", "")

        pdf.set_font("Helvetica", "B", 28)
        pdf.set_text_color(248, 250, 252)
        pdf.set_fill_color(10, 15, 26)
        pdf.cell(0, 15, "Trust Report", ln=True)
        pdf.ln(2)

        if timestamp:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(100, 116, 139)
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                pdf.cell(0, 6, f"Generated: {dt.strftime('%B %d, %Y at %H:%M UTC')}", ln=True)
            except Exception:
                pdf.cell(0, 6, f"Generated: {timestamp}", ln=True)
        pdf.ln(8)

        score_color = (16, 185, 129) if trust_score >= 75 else (245, 158, 11) if trust_score >= 50 else (239, 68, 68) if trust_score >= 25 else (153, 27, 27)
        pdf.set_font("Helvetica", "B", 48)
        pdf.set_text_color(*score_color)
        pdf.cell(50, 25, str(trust_score), align="L")
        pdf.set_font("Helvetica", "", 14)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(30, 25, "/ 100", align="L")

        risk_color = {"LOW": (16,185,129), "MEDIUM": (245,158,11), "HIGH": (239,68,68), "CRITICAL": (153,27,27)}.get(decision_risk, (100,116,139))
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(*risk_color)
        pdf.cell(0, 25, f"{decision_risk} RISK", align="R", ln=True)
        pdf.ln(5)

        pdf.set_draw_color(30, 41, 59)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)

        stat_items = [
            ("Verified", summary.get("verified",0), (16,185,129)),
            ("Wrong", summary.get("wrong",0), (239,68,68)),
            ("Partial", summary.get("partial",0), (245,158,11)),
            ("Logic Gaps", summary.get("logic_gap",0), (139,92,246)),
            ("Unverifiable", summary.get("unverifiable",0), (107,114,128)),
            ("Inconsistent", summary.get("inconsistent",0), (168,85,247)),
        ]
        pdf.set_font("Helvetica", "B", 10)
        col_w = 32
        for label, count, color in stat_items:
            pdf.set_text_color(*color)
            pdf.cell(col_w, 8, f"{count} {label}", align="L")
        pdf.ln(12)

        pdf.set_draw_color(30, 41, 59)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(8)

        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(248, 250, 252)
        pdf.cell(0, 10, f"Claims ({len(claims)})", ln=True)
        pdf.ln(4)

        status_colors = {
            "verified": (16,185,129), "wrong": (239,68,68), "partial": (245,158,11),
            "logic_gap": (139,92,246), "unverifiable": (107,114,128), "inconsistent": (168,85,247),
        }

        for i, claim in enumerate(claims):
            color = status_colors.get(claim.get("status"), (107,114,128))
            status_label = STATUS_LABELS.get(claim.get("status"), "UNKNOWN")
            if pdf.get_y() > 240:
                pdf.add_page()

            # Status + confidence
            conf = claim.get("confidence_score")
            conf_str = f"  [{int(conf*100)}% confidence]" if conf else ""
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*color)
            status_text = f"[{status_label}]{conf_str}"
            risk = claim.get("risk_level", "NORMAL")
            if risk == "HIGH":
                status_text += "  HIGH"
            ct = claim.get("claim_type", "").replace("_", " ").upper()
            pdf.cell(0, 6, f"{status_text}    {ct}", ln=True)

            pdf.set_x(10)
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(248, 250, 252)
            pdf.multi_cell(190, 5, _safe_text(claim.get("claim_text", "")))

            cv, av = claim.get("claimed_value"), claim.get("actual_value")
            if cv or av:
                pdf.set_font("Helvetica", "", 9)
                if cv:
                    pdf.set_x(10); pdf.set_text_color(148,163,184)
                    pdf.cell(0, 5, f"Claimed: {_safe_text(cv)}", ln=True)
                if av:
                    pdf.set_x(10); pdf.set_text_color(*color)
                    pdf.cell(0, 5, f"Actual:  {_safe_text(av)}", ln=True)

            explanation = claim.get("explanation")
            if explanation:
                pdf.set_x(10)
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(100, 116, 139)
                pdf.multi_cell(190, 4.5, _safe_text(explanation))
            pdf.ln(4)

        for section_title, items in [("What's Missing", missing), ("Hidden Assumptions", assumptions), ("Alternative Explanations", alternatives)]:
            if not items:
                continue
            if pdf.get_y() > 230:
                pdf.add_page()
            pdf.ln(4)
            pdf.set_draw_color(30, 41, 59)
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(6)
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(248, 250, 252)
            pdf.cell(0, 10, section_title, ln=True)
            pdf.ln(2)
            for j, item in enumerate(items):
                if pdf.get_y() > 260:
                    pdf.add_page()
                pdf.set_x(10)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(100, 116, 139)
                pdf.cell(12, 5, f"{j+1:02d}")
                pdf.set_text_color(148, 163, 184)
                pdf.multi_cell(178, 5, _safe_text(item))
                pdf.ln(1)

        pdf_bytes = pdf.output()
        return Response(
            content=bytes(pdf_bytes), media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=trustlayer-report-{trust_score}.pdf"},
        )
    except Exception as e:
        logger.error(f"PDF export error: {traceback.format_exc()}")
        raise HTTPException(500, f"PDF generation failed: {str(e)}")


# ===========================================================================
# HEALTH CHECK
# ===========================================================================

@api_router.get("/health")
async def health_check():
    try:
        await mongo_client.admin.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok", "db": db_status, "timestamp": datetime.now(timezone.utc).isoformat()}


# ===========================================================================
# MOUNT
# ===========================================================================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static build if exists
STATIC_DIR = ROOT_DIR / "static"
if STATIC_DIR.exists():
    from starlette.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
