from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import json
import traceback
from pathlib import Path
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import pandas as pd
import numpy as np

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@api_router.get("/")
async def root():
    return {"message": "TrustLayer API"}


@api_router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename or "data.csv"
        if filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))

        preview_rows = json.loads(df.head(5).to_json(orient='records', default_handler=str))
        all_rows = json.loads(df.to_json(orient='records', default_handler=str))

        return {
            "columns": list(df.columns),
            "preview_rows": preview_rows,
            "all_rows": all_rows,
            "total_rows": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


@api_router.post("/parse-csv-text")
async def parse_csv_text(data: dict):
    try:
        csv_text = data.get("csv_text", "")
        df = pd.read_csv(io.StringIO(csv_text))
        preview_rows = json.loads(df.head(5).to_json(orient='records', default_handler=str))
        all_rows = json.loads(df.to_json(orient='records', default_handler=str))
        return {
            "columns": list(df.columns),
            "preview_rows": preview_rows,
            "all_rows": all_rows,
            "total_rows": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV text: {str(e)}")


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


@api_router.post("/validate")
async def validate_analysis(data: dict):
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    csv_data = data.get("csv_data", [])
    analysis_text = data.get("analysis_text", "")
    api_key = data.get("api_key", "")

    if not csv_data or not analysis_text or not api_key:
        raise HTTPException(status_code=400, detail="csv_data, analysis_text, and api_key are required")

    try:
        df = pd.DataFrame(csv_data)
        cols_info = (
            f"Columns: {list(df.columns)}\n"
            f"Shape: {df.shape}\n"
            f"Dtypes:\n{df.dtypes.to_string()}\n"
            f"Sample (first 3 rows):\n{df.head(3).to_string()}"
        )

        # Step 1: Decompose claims
        chat = LlmChat(
            api_key=api_key,
            session_id=f"tl-decompose-{uuid.uuid4()}",
            system_message="You decompose business analyses into atomic claims for data validation. Respond with valid JSON only, no markdown fences."
        )
        chat.with_model("openai", "gpt-4o-mini")

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

        resp = await chat.send_message(UserMessage(text=decompose_msg))
        resp_clean = resp.strip()
        if resp_clean.startswith("```"):
            resp_clean = resp_clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        raw_claims = json.loads(resp_clean)

        # Step 2-3: Verify each claim
        claims = []
        for rc in raw_claims:
            claim = {
                "id": str(uuid.uuid4()),
                "claim_text": rc["claim_text"],
                "claim_type": rc["claim_type"],
                "risk_level": rc.get("risk_level", "NORMAL"),
                "claimed_value": None,
                "actual_value": None,
                "explanation": "",
                "verification_code": None,
                "status": "unverifiable",
            }

            if rc.get("verifiable") and rc["claim_type"] in ["numeric_fact", "comparison"]:
                v_chat = LlmChat(
                    api_key=api_key,
                    session_id=f"tl-verify-{uuid.uuid4()}",
                    system_message=(
                        "Generate pandas code to verify a claim. Return ONLY Python code, no markdown. "
                        "The DataFrame is `df`. Store your answer in `result` as a dict with keys: "
                        "claimed_value (str), actual_value (str), matches (bool), explanation (str)."
                    ),
                )
                v_chat.with_model("openai", "gpt-4o-mini")

                code_resp = await v_chat.send_message(
                    UserMessage(text=f"Verify this claim: {rc['claim_text']}\n\nData:\n{cols_info}")
                )
                code = code_resp.strip()
                if code.startswith("```"):
                    code = code.split("\n", 1)[1].rsplit("```", 1)[0].strip()

                claim["verification_code"] = code
                exec_result = execute_pandas_code(code, df)

                if isinstance(exec_result, dict):
                    claim["claimed_value"] = str(exec_result.get("claimed_value", "N/A"))
                    claim["actual_value"] = str(exec_result.get("actual_value", "N/A"))
                    claim["explanation"] = exec_result.get("explanation", "")
                    claim["status"] = "verified" if exec_result.get("matches") else "wrong"
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

        # Step 4: Missing context analysis
        m_chat = LlmChat(
            api_key=api_key,
            session_id=f"tl-missing-{uuid.uuid4()}",
            system_message="Analyze for missing context in business analysis. Return valid JSON only, no markdown fences.",
        )
        m_chat.with_model("openai", "gpt-4o-mini")

        m_resp = await m_chat.send_message(
            UserMessage(
                text=f"""Given this data and analysis, identify gaps.

DATA: {cols_info}
ANALYSIS: {analysis_text}

Return JSON object with keys:
- "missing_context": array of things the analysis should mention but doesn't
- "hidden_assumptions": array of assumptions baked into the analysis
- "alternative_explanations": array of alternative interpretations"""
            )
        )
        m_clean = m_resp.strip()
        if m_clean.startswith("```"):
            m_clean = m_clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        missing = json.loads(m_clean)

        # Calculate score
        summary = {
            "verified": sum(1 for c in claims if c["status"] == "verified"),
            "wrong": sum(1 for c in claims if c["status"] == "wrong"),
            "partial": sum(1 for c in claims if c["status"] == "partial"),
            "logic_gap": sum(1 for c in claims if c["status"] == "logic_gap"),
            "unverifiable": sum(1 for c in claims if c["status"] == "unverifiable"),
        }
        total = len(claims)
        score = int(((summary["verified"] + summary["partial"] * 0.5) / max(total, 1)) * 100)

        if score >= 75:
            risk = "LOW"
        elif score >= 50:
            risk = "MEDIUM"
        elif score >= 25:
            risk = "HIGH"
        else:
            risk = "CRITICAL"

        result = {
            "id": str(uuid.uuid4()),
            "trust_score": score,
            "decision_risk": risk,
            "claims": claims,
            "missing_context": missing.get("missing_context", []),
            "hidden_assumptions": missing.get("hidden_assumptions", []),
            "alternative_explanations": missing.get("alternative_explanations", []),
            "summary": summary,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_demo": False,
        }

        # Store in MongoDB (use a copy to avoid _id mutation)
        await db.validations.insert_one({**result, "_id": str(uuid.uuid4())})

        return result

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        logger.error(f"Validation error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/validations")
async def get_validations():
    validations = await db.validations.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return validations


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
