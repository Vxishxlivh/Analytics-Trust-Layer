from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import json
import re
import traceback
from pathlib import Path
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import requests
from fpdf import FPDF

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
        df = None

        if filename.endswith(('.xlsx', '.xls')):
            try:
                df = pd.read_excel(io.BytesIO(content))
            except Exception:
                # Fallback: try parsing as CSV if Excel fails
                df = pd.read_csv(io.BytesIO(content))
        else:
            try:
                df = pd.read_csv(io.BytesIO(content))
            except Exception:
                # Fallback: try parsing as Excel if CSV fails
                df = pd.read_excel(io.BytesIO(content))

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


@api_router.post("/parse-google-sheet")
async def parse_google_sheet(data: dict):
    url = data.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Extract sheet ID from various Google Sheets URL formats
    patterns = [
        r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
        r'key=([a-zA-Z0-9-_]+)',
    ]
    sheet_id = None
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            sheet_id = match.group(1)
            break

    if not sheet_id:
        raise HTTPException(status_code=400, detail="Could not extract sheet ID from URL. Make sure the sheet is publicly shared.")

    # Extract gid if present
    gid_match = re.search(r'gid=(\d+)', url)
    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid_match:
        export_url += f"&gid={gid_match.group(1)}"

    try:
        resp = requests.get(export_url, timeout=15)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Failed to fetch sheet. Make sure it is set to 'Anyone with the link can view'."
            )

        df = pd.read_csv(io.StringIO(resp.text))
        preview_rows = json.loads(df.head(5).to_json(orient='records', default_handler=str))
        all_rows = json.loads(df.to_json(orient='records', default_handler=str))

        return {
            "columns": list(df.columns),
            "preview_rows": preview_rows,
            "all_rows": all_rows,
            "total_rows": len(df),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Google Sheet: {str(e)}")


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
    validations = await db.validations.find(
        {}, {"_id": 0, "claims": 0, "missing_context": 0, "hidden_assumptions": 0, "alternative_explanations": 0}
    ).sort("timestamp", -1).to_list(100)
    return validations


@api_router.get("/validations/{validation_id}")
async def get_validation(validation_id: str):
    doc = await db.validations.find_one({"id": validation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Validation not found")
    return doc


@api_router.delete("/validations/{validation_id}")
async def delete_validation(validation_id: str):
    result = await db.validations.delete_one({"id": validation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Validation not found")
    return {"deleted": True}


# --- PDF Export ---
STATUS_LABELS = {
    "verified": "VERIFIED",
    "wrong": "WRONG",
    "partial": "PARTIAL",
    "logic_gap": "LOGIC GAP",
    "unverifiable": "UNVERIFIABLE",
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

        # Title
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

        # Score & Risk
        score_color = (16, 185, 129) if trust_score >= 75 else (245, 158, 11) if trust_score >= 50 else (239, 68, 68) if trust_score >= 25 else (153, 27, 27)
        pdf.set_font("Helvetica", "B", 48)
        pdf.set_text_color(*score_color)
        pdf.cell(50, 25, str(trust_score), align="L")
        pdf.set_font("Helvetica", "", 14)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(30, 25, "/ 100", align="L")

        risk_color = {"LOW": (16, 185, 129), "MEDIUM": (245, 158, 11), "HIGH": (239, 68, 68), "CRITICAL": (153, 27, 27)}.get(decision_risk, (100, 116, 139))
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(*risk_color)
        pdf.cell(0, 25, f"{decision_risk} RISK", align="R", ln=True)
        pdf.ln(5)

        # Summary bar
        pdf.set_draw_color(30, 41, 59)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)

        stat_items = [
            ("Verified", summary.get("verified", 0), (16, 185, 129)),
            ("Wrong", summary.get("wrong", 0), (239, 68, 68)),
            ("Partial", summary.get("partial", 0), (245, 158, 11)),
            ("Logic Gaps", summary.get("logic_gap", 0), (139, 92, 246)),
            ("Unverifiable", summary.get("unverifiable", 0), (107, 114, 128)),
        ]
        pdf.set_font("Helvetica", "B", 11)
        col_w = 38
        for label, count, color in stat_items:
            pdf.set_text_color(*color)
            pdf.cell(col_w, 8, f"{count} {label}", align="L")
        pdf.ln(12)

        pdf.set_draw_color(30, 41, 59)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(8)

        # Claims
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(248, 250, 252)
        pdf.cell(0, 10, f"Claims ({len(claims)})", ln=True)
        pdf.ln(4)

        status_colors = {
            "verified": (16, 185, 129),
            "wrong": (239, 68, 68),
            "partial": (245, 158, 11),
            "logic_gap": (139, 92, 246),
            "unverifiable": (107, 114, 128),
        }

        for i, claim in enumerate(claims):
            color = status_colors.get(claim.get("status"), (107, 114, 128))
            status_label = STATUS_LABELS.get(claim.get("status"), "UNKNOWN")

            # Check if we need a new page
            if pdf.get_y() > 240:
                pdf.add_page()

            # Status + type line
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*color)
            status_text = f"[{status_label}]"
            risk = claim.get("risk_level", "NORMAL")
            if risk == "HIGH":
                status_text += "  HIGH"
            claim_type = claim.get("claim_type", "").replace("_", " ").upper()
            pdf.cell(0, 6, f"{status_text}    {claim_type}", ln=True)

            # Claim text
            pdf.set_x(10)
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(248, 250, 252)
            pdf.multi_cell(190, 5, _safe_text(claim.get("claim_text", "")))

            # Claimed vs Actual
            cv = claim.get("claimed_value")
            av = claim.get("actual_value")
            if cv or av:
                pdf.set_font("Helvetica", "", 9)
                if cv:
                    pdf.set_x(10)
                    pdf.set_text_color(148, 163, 184)
                    pdf.cell(0, 5, f"Claimed: {_safe_text(cv)}", ln=True)
                if av:
                    pdf.set_x(10)
                    pdf.set_text_color(*color)
                    pdf.cell(0, 5, f"Actual:  {_safe_text(av)}", ln=True)

            # Explanation
            explanation = claim.get("explanation")
            if explanation:
                pdf.set_x(10)
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(100, 116, 139)
                pdf.multi_cell(190, 4.5, _safe_text(explanation))

            pdf.ln(4)

        # Analysis sections
        for section_title, items in [
            ("What's Missing", missing),
            ("Hidden Assumptions", assumptions),
            ("Alternative Explanations", alternatives),
        ]:
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

        # Generate PDF bytes
        pdf_bytes = pdf.output()

        return Response(
            content=bytes(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=trustlayer-report-{trust_score}.pdf"
            },
        )

    except Exception as e:
        logger.error(f"PDF export error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


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
