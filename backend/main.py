# backend/main.py
import asyncio
import io
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

try:
    import pandas as pd
    _PANDAS_OK = True
except ImportError:
    _PANDAS_OK = False

# ── Path setup ─────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from crew import run_finsage_crew
from agents.debt_optimizer_agent import calculate_avalanche_plan, calculate_snowball_plan
from services.logger import api_logger, llm_logger, APICallTimer, log_llm_call
from services.redis_client import (
    cache_get, cache_set, cache_delete_pattern,
    key_transactions, key_debts, key_goals, key_goal_insights,
    key_credit_tips, key_savings_insights, key_analysis,
)

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FinSage API",
    description="AI-powered personal finance advisor. Powered by CrewAI + FastAPI.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://finsage-0149.vercel.app",
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://192.168.10.170:8080",
        "http://localhost:5173", "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ───────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    name: str; age: int; city: str
    monthly_income: int; cibil_score: int; risk_profile: str = "moderate"

class Expense(BaseModel):
    category: str; amount: int; month: str; ai_tag: str

class Loan(BaseModel):
    name: str; outstanding_balance: int; emi_amount: int
    interest_rate: float; tenure_remaining_months: int; loan_type: str

class Goal(BaseModel):
    name: str; target_amount: int; current_savings: int
    monthly_contribution: int; target_date: str

class FinancialProfile(BaseModel):
    user: UserProfile; expenses: List[Expense]
    loans: List[Loan]; goals: List[Goal]

class DebtPlanRequest(BaseModel):
    loans: List[Loan]
    monthly_surplus: int = Field(..., gt=0)

class AddTransactionRequest(BaseModel):
    user_id: int; date: str; description: str; category: str
    amount: float; type: Literal["debit", "credit"]; notes: str = ""

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    context: Optional[dict] = None

class GoalsInsightsRequest(BaseModel):
    goals: List[dict]
    transactions_summary: Optional[dict] = None
    user_id: Optional[str] = None

class DebtStrategyRequest(BaseModel):
    debts: List[dict]
    extra_monthly_payment: int = 5000
    user_id: Optional[str] = None

class CreditTipsRequest(BaseModel):
    user_id: Optional[str] = None
    credit_score_estimate: int = 750
    loans: Optional[List[dict]] = None

class SavingsInsightsRequest(BaseModel):
    savings: List[dict]
    user_id: Optional[str] = None
    monthly_expenses: Optional[float] = None

# ─── In-memory store ───────────────────────────────────────────────────────────
transaction_store: List[dict] = []

# ─── Helpers ──────────────────────────────────────────────────────────────────
MOCK_DATA_DIR = os.path.join(BASE_DIR, "mock_data")
VALID_DEMO_IDS = {1, 2, 3}

def load_mock_user(user_id: int) -> dict:
    path = os.path.join(MOCK_DATA_DIR, f"user{user_id}.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _expenses_to_transactions(expenses: list, user_id: int) -> list:
    result = []
    for idx, exp in enumerate(expenses):
        result.append({
            "id": str(uuid4()),
            "date": f"2026-03-{str(idx + 1).zfill(2)}",
            "description": f"{exp['category']} Payment",
            "category": exp["category"],
            "amount": float(exp["amount"]),
            "type": "debit",
            "source": "statement",
            "ai_tag": exp.get("ai_tag", ""),
        })
    return result

def _next_due_date(due_day: int) -> str:
    today = date.today()
    candidate = today.replace(day=min(due_day, 28))
    if candidate < today:
        if today.month == 12:
            candidate = candidate.replace(year=today.year + 1, month=1)
        else:
            candidate = candidate.replace(month=today.month + 1)
    return candidate.isoformat()

def _validate_date(date_str: str) -> None:
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date '{date_str}'. Expected: YYYY-MM-DD",
        )

def _openrouter_chat(messages: list, max_tokens: int = 600) -> tuple[str, int, int]:
    """Call OpenRouter and return (content, input_tokens, output_tokens)."""
    import requests as req_lib
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    model = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

    if not api_key:
        return "AI service not configured. Add OPENROUTER_API_KEY to backend .env.", 0, 0

    resp = req_lib.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://finsage.app",
            "X-Title": "FinSage",
        },
        json={"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.7},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return content, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)


# ══════════════════════════════════════════════════════════════════════════════
# EXISTING ENDPOINTS (upgraded with logging + Redis caching)
# ══════════════════════════════════════════════════════════════════════════════

# 1. GET /health ---------------------------------------------------------------
@app.get("/health", tags=["System"])
def health_check():
    with APICallTimer("/health"):
        return {"status": "ok", "service": "FinSage API", "version": "2.0.0"}

# 2. GET /demo/{user_id} -------------------------------------------------------
@app.get("/demo/{user_id}", tags=["Demo"])
def run_demo_analysis(user_id: int):
    with APICallTimer(f"/demo/{user_id}"):
        if user_id not in VALID_DEMO_IDS:
            raise HTTPException(status_code=404, detail="Demo user not found. Use 1, 2, or 3.")
        user_data = load_mock_user(user_id)
        analysis = run_finsage_crew(user_data)
        return {"user_name": user_data["user"]["name"], "city": user_data["user"]["city"],
                "analysis": analysis, "status": "success"}

# 3. POST /analyze -------------------------------------------------------------
@app.post("/analyze", tags=["Analysis"])
def analyze_custom_profile(profile: FinancialProfile):
    with APICallTimer("/analyze", method="POST"):
        user_data = profile.model_dump()
        analysis = run_finsage_crew(user_data)
        return {"analysis": analysis, "status": "success", "user_name": profile.user.name}

# 4. POST /debt-plan -----------------------------------------------------------
@app.post("/debt-plan", tags=["Debt"])
async def get_debt_plan(request: DebtPlanRequest):
    with APICallTimer("/debt-plan", method="POST"):
        cache_key = f"debt-plan:{hash(str(request.model_dump()))}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        loans_raw = [l.model_dump() for l in request.loans]
        surplus = request.monthly_surplus
        avalanche_plan = calculate_avalanche_plan(loans_raw, surplus)
        snowball_plan = calculate_snowball_plan(loans_raw, surplus)

        result = {
            "avalanche_plan": avalanche_plan,
            "snowball_plan": snowball_plan,
            "recommended": "avalanche",
            "reason": "Saves more interest mathematically",
        }
        await cache_set(cache_key, result, ttl=3600)
        return result

# 5. GET /mock-profile/{user_id} -----------------------------------------------
@app.get("/mock-profile/{user_id}", tags=["Demo"])
async def get_mock_profile(user_id: int):
    with APICallTimer(f"/mock-profile/{user_id}"):
        if user_id not in VALID_DEMO_IDS:
            raise HTTPException(status_code=404, detail="Demo user not found. Use 1, 2, or 3.")
        cache_key = f"mock-profile:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            return cached
        data = load_mock_user(user_id)
        await cache_set(cache_key, data, ttl=3600)
        return data

# 6. GET /report/{user_id} — streaming -----------------------------------------
@app.get("/report/{user_id}", tags=["Analysis"])
async def stream_full_report(user_id: int):
    if user_id not in VALID_DEMO_IDS:
        raise HTTPException(status_code=404, detail="Demo user not found. Use 1, 2, or 3.")

    user_data = load_mock_user(user_id)

    async def generate():
        try:
            loop = asyncio.get_event_loop()
            future = loop.run_in_executor(None, run_finsage_crew, user_data)
            while not future.done():
                try:
                    await asyncio.wait_for(asyncio.shield(future), timeout=5.0)
                except asyncio.TimeoutError:
                    yield "\x00"
            result = future.result()
            chunk_size = 200
            for i in range(0, len(result), chunk_size):
                yield result[i: i + chunk_size]
        except asyncio.CancelledError:
            return
        except Exception:
            fallback = (
                f"FinSage Analysis for {user_data['user']['name']} "
                f"({user_data['user']['city']})\n\n"
                f"Monthly Income: ₹{user_data['user']['monthly_income']:,}\n"
                f"CIBIL Score: {user_data['user']['cibil_score']}\n\n"
                "The full AI analysis pipeline is temporarily unavailable."
            )
            yield fallback

    return StreamingResponse(generate(), media_type="text/plain", headers={"X-Agent-Count": "6"})

# 7. GET /transactions/{user_id} ----------------------------------------------
@app.get("/transactions/{user_id}", tags=["Transactions"])
async def get_transactions(user_id: int):
    with APICallTimer(f"/transactions/{user_id}", user_id=str(user_id)):
        if user_id not in VALID_DEMO_IDS:
            raise HTTPException(status_code=404, detail="User not found. Use 1, 2, or 3.")

        cache_key = key_transactions(str(user_id))
        cached = await cache_get(cache_key)
        if cached:
            return cached

        try:
            user_data = load_mock_user(user_id)
            txns = _expenses_to_transactions(user_data["expenses"], user_id)
            manual = [t for t in transaction_store if t.get("user_id") == user_id]
            for t in manual:
                txns.append({k: v for k, v in t.items() if k != "user_id"})
            result = {"transactions": txns, "total": len(txns), "user_id": user_id}
            await cache_set(cache_key, result, ttl=120)
            return result
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Mock data for user {user_id} not found.")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to load transactions: {exc}")

# 8. POST /transactions/add ---------------------------------------------------
@app.post("/transactions/add", tags=["Transactions"], status_code=201)
async def add_transaction(req: AddTransactionRequest):
    with APICallTimer("/transactions/add", user_id=str(req.user_id), method="POST"):
        if req.amount <= 0:
            raise HTTPException(status_code=422, detail="amount must be greater than 0")
        if req.type not in ("debit", "credit"):
            raise HTTPException(status_code=422, detail="type must be 'debit' or 'credit'")
        _validate_date(req.date)

        try:
            txn = {
                "id": str(uuid4()), "user_id": req.user_id, "date": req.date,
                "description": req.description, "category": req.category,
                "amount": float(req.amount), "type": req.type,
                "source": "manual", "ai_tag": "", "notes": req.notes,
            }
            transaction_store.append(txn)
            # Invalidate cache
            await cache_delete_pattern(f"user:{req.user_id}:*")
            await cache_delete_pattern(key_transactions(str(req.user_id)))
            return {k: v for k, v in txn.items() if k != "user_id"} | {"status": "created"}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to save transaction: {exc}")

# 9. POST /statement/parse ---------------------------------------------------
@app.post("/statement/parse", tags=["Transactions"])
async def parse_statement(file: UploadFile = File(...), bank_name: str = Form("Unknown")):
    with APICallTimer("/statement/parse", method="POST"):
        try:
            content = await file.read()
            filename = (file.filename or "").lower()
            is_csv = filename.endswith(".csv") or (file.content_type or "").startswith("text/csv")

            if is_csv and _PANDAS_OK:
                try:
                    df = pd.read_csv(io.BytesIO(content))
                    df.columns = [c.lower().strip() for c in df.columns]

                    def _find_col(keywords):
                        for kw in keywords:
                            for col in df.columns:
                                if kw in col:
                                    return col
                        return None

                    date_col = _find_col(["date", "time", "txn date"])
                    desc_col = _find_col(["description", "narration", "particular", "details"])
                    debit_col = _find_col(["debit", "withdrawal", "dr"])
                    credit_col = _find_col(["credit", "deposit", "cr"])
                    amount_col = _find_col(["amount"]) if not (debit_col or credit_col) else None

                    txns = []
                    for _, row in df.iterrows():
                        try:
                            raw_date = str(row[date_col]) if date_col else "2026-03-01"
                            desc = str(row[desc_col]) if desc_col else "Bank Transaction"
                            debit_val = float(row[debit_col]) if debit_col and pd.notna(row[debit_col]) else 0.0
                            credit_val = float(row[credit_col]) if credit_col and pd.notna(row[credit_col]) else 0.0
                            if amount_col:
                                amt_raw = float(row[amount_col]) if pd.notna(row[amount_col]) else 0.0
                                debit_val = amt_raw if amt_raw > 0 else 0.0
                            txn_type = "credit" if credit_val > debit_val else "debit"
                            amount = credit_val if txn_type == "credit" else debit_val
                            try:
                                parsed_d = pd.to_datetime(raw_date, dayfirst=True)
                                txn_date = parsed_d.strftime("%Y-%m-%d")
                            except Exception:
                                txn_date = "2026-03-01"
                            txns.append({
                                "id": str(uuid4()), "date": txn_date,
                                "description": desc.strip(), "category": "Uncategorised",
                                "amount": round(amount, 2), "type": txn_type,
                                "source": "statement", "ai_tag": "",
                            })
                        except Exception:
                            continue
                    return {"transactions": txns, "count": len(txns), "bank_name": bank_name,
                            "parse_mode": "real", "message": f"Parsed {len(txns)} transactions from CSV."}
                except Exception:
                    pass

            user_data = load_mock_user(1)
            sim_txns = _expenses_to_transactions(user_data["expenses"], 1)
            return JSONResponse(
                content={"transactions": sim_txns, "count": len(sim_txns), "bank_name": bank_name,
                         "parse_mode": "simulated",
                         "message": "PDF/binary parsing not supported — showing demo transactions."},
                headers={"X-Parse-Mode": "simulated"},
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Statement parse failed: {exc}")

# 10. GET /calendar/{user_id} -------------------------------------------------
@app.get("/calendar/{user_id}", tags=["Calendar"])
async def get_calendar(user_id: int):
    with APICallTimer(f"/calendar/{user_id}", user_id=str(user_id)):
        if user_id not in VALID_DEMO_IDS:
            raise HTTPException(status_code=404, detail="User not found. Use 1, 2, or 3.")

        cache_key = f"calendar:{user_id}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        try:
            user_data = load_mock_user(user_id)
            user = user_data["user"]
            loans = user_data["loans"]

            emi_events = [
                {"name": loan["name"], "amount": float(loan["emi_amount"]),
                 "due_day": 5, "type": "emi", "color": "red"}
                for loan in loans
            ]
            income_events = [
                {"name": "Salary Credit", "amount": float(user["monthly_income"]),
                 "expected_day": 1, "type": "income", "color": "green"}
            ]

            raw_txns = _expenses_to_transactions(user_data["expenses"], user_id)
            manual = [t for t in transaction_store if t.get("user_id") == user_id]
            for t in manual:
                raw_txns.append({k: v for k, v in t.items() if k != "user_id"})

            transaction_events = []
            for t in raw_txns:
                color = "green" if t["type"] == "credit" else ("orange" if t["amount"] > 2000 else "blue")
                transaction_events.append({
                    "date": t["date"], "description": t["description"],
                    "amount": t["amount"], "type": t["type"],
                    "category": t["category"], "color": color,
                })

            today = date.today()
            upcoming_payments = []
            for loan in loans:
                due_date_str = _next_due_date(5)
                due_date_obj = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                days_remaining = (due_date_obj - today).days
                upcoming_payments.append({
                    "name": loan["name"], "amount": float(loan["emi_amount"]),
                    "due_date": due_date_str, "days_remaining": days_remaining,
                    "type": "emi",
                })
            upcoming_payments.sort(key=lambda x: x["days_remaining"])

            total_emis = sum(float(l["emi_amount"]) for l in loans)
            day_totals: Dict[str, float] = {}
            for t in raw_txns:
                if t["type"] == "debit":
                    day_totals[t["date"]] = day_totals.get(t["date"], 0.0) + t["amount"]
            biggest_expense_day = max(day_totals, key=lambda d: day_totals[d]) if day_totals else ""

            result = {
                "emi_events": emi_events,
                "income_events": income_events,
                "transaction_events": transaction_events,
                "upcoming_payments": upcoming_payments,
                "monthly_summary": {
                    "total_emis": total_emis,
                    "expected_income": float(user["monthly_income"]),
                    "transaction_count": len(raw_txns),
                    "biggest_expense_day": biggest_expense_day,
                },
            }
            await cache_set(cache_key, result, ttl=300)
            return result

        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Mock data for user {user_id} not found.")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Calendar build failed: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
# NEW AI / FEATURE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# 11. POST /api/chat ----------------------------------------------------------
@app.post("/api/chat", tags=["AI"])
async def chat_endpoint(req: ChatRequest):
    with APICallTimer("/api/chat", user_id=req.user_id, method="POST"):
        from services.chat_service import chat
        result = chat(
            message=req.message,
            user_id=req.user_id,
            context=req.context,
        )
        return result

# 12. POST /api/goals/insights ------------------------------------------------
@app.post("/api/goals/insights", tags=["AI"])
async def goals_insights(req: GoalsInsightsRequest):
    with APICallTimer("/api/goals/insights", user_id=req.user_id, method="POST"):
        uid = req.user_id or "anon"
        cache_key = key_goal_insights(uid)
        cached = await cache_get(cache_key)
        if cached:
            return cached

        goals_text = json.dumps(req.goals, indent=2)
        txn_text = json.dumps(req.transactions_summary or {}, indent=2)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are FinSage AI, a personal finance advisor for Indian professionals. "
                    "Analyze the user's financial goals and return a JSON object with: "
                    '{ "suggestions": [{"goalName": string, "suggestion": string}], '
                    '"criticalInsight": string }'
                    "Keep each suggestion under 30 words. criticalInsight under 50 words."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"My financial goals:\n{goals_text}\n\n"
                    f"Transaction summary:\n{txn_text}\n\n"
                    "Give me specific AI suggestions for each goal and one critical insight."
                ),
            },
        ]

        start = time.time()
        try:
            content, inp_tok, out_tok = _openrouter_chat(messages, max_tokens=600)
            log_llm_call(
                "goals_insights_agent",
                os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
                inp_tok, out_tok,
                (time.time() - start) * 1000,
                user_id=uid,
                success=True,
            )
            result = {"response": content}
            await cache_set(cache_key, result, ttl=1800)
            return result
        except Exception as exc:
            log_llm_call("goals_insights_agent", os.getenv("OPENROUTER_MODEL", ""), 0, 0,
                         (time.time() - start) * 1000, uid, False, str(exc))
            raise HTTPException(status_code=500, detail=f"Goals insights failed: {exc}")

# 13. POST /api/debt/credit-tips ----------------------------------------------
@app.post("/api/debt/credit-tips", tags=["AI"])
async def credit_tips(req: CreditTipsRequest):
    with APICallTimer("/api/debt/credit-tips", user_id=req.user_id, method="POST"):
        uid = req.user_id or "anon"
        cache_key = key_credit_tips(uid)
        cached = await cache_get(cache_key)
        if cached:
            return cached

        score = req.credit_score_estimate
        loans_text = json.dumps(req.loans or [], indent=2)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a credit score expert for Indian consumers. "
                    "Return exactly 5 actionable tips as a JSON array: "
                    '[{"title": string, "status": "good"|"warning", "current": string, "nextStep": string}]'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"My estimated CIBIL score: {score}\n"
                    f"My loans: {loans_text}\n\n"
                    "Give me 5 specific tips to improve or maintain my credit score."
                ),
            },
        ]

        start = time.time()
        try:
            content, inp_tok, out_tok = _openrouter_chat(messages, max_tokens=500)
            log_llm_call(
                "credit_tips_agent",
                os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
                inp_tok, out_tok,
                (time.time() - start) * 1000,
                user_id=uid,
                success=True,
            )
            # Try to parse as JSON array, fallback to raw text
            try:
                import re
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    tips = json.loads(json_match.group())
                else:
                    tips = []
            except Exception:
                tips = []

            result = {"tips": tips, "raw": content}
            await cache_set(cache_key, result, ttl=3600)
            return result
        except Exception as exc:
            log_llm_call("credit_tips_agent", os.getenv("OPENROUTER_MODEL", ""), 0, 0,
                         (time.time() - start) * 1000, uid, False, str(exc))
            raise HTTPException(status_code=500, detail=f"Credit tips failed: {exc}")

# 14. POST /api/debt/strategy -------------------------------------------------
@app.post("/api/debt/strategy", tags=["Debt"])
async def debt_strategy(req: DebtStrategyRequest):
    with APICallTimer("/api/debt/strategy", user_id=req.user_id, method="POST"):
        debts = req.debts
        extra = req.extra_monthly_payment

        # Convert to the shape expected by the existing calculator
        backend_loans = []
        for d in debts:
            backend_loans.append({
                "name": d.get("title", d.get("name", "Loan")),
                "outstanding_balance": int(d.get("remainingBalance", d.get("outstanding_balance", 0))),
                "emi_amount": int(d.get("emiAmount", d.get("emi_amount", 0))),
                "interest_rate": float(d.get("interestRate", d.get("interest_rate", 10))),
                "tenure_remaining_months": int(d.get("tenure_remaining_months", 24)),
                "loan_type": d.get("type", "personal"),
            })

        snowball_plan = calculate_snowball_plan(backend_loans, extra)
        avalanche_plan = calculate_avalanche_plan(backend_loans, extra)

        return {
            "snowball_plan": snowball_plan,
            "avalanche_plan": avalanche_plan,
            "extra_monthly_payment": extra,
        }

# 15. POST /api/savings/insights ----------------------------------------------
@app.post("/api/savings/insights", tags=["AI"])
async def savings_insights(req: SavingsInsightsRequest):
    with APICallTimer("/api/savings/insights", user_id=req.user_id, method="POST"):
        uid = req.user_id or "anon"
        cache_key = key_savings_insights(uid)
        cached = await cache_get(cache_key)
        if cached:
            return cached

        savings_text = json.dumps(req.savings, indent=2)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a savings advisor for Indian professionals. "
                    "Return 3 short, actionable insights as a JSON array of strings. "
                    "Each insight under 20 words. Focus on FD rates, emergency fund, and reinvestment."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"My savings portfolio:\n{savings_text}\n"
                    f"Monthly expenses: ₹{req.monthly_expenses or 'unknown'}\n\n"
                    "Give me 3 savings insights."
                ),
            },
        ]

        start = time.time()
        try:
            content, inp_tok, out_tok = _openrouter_chat(messages, max_tokens=300)
            log_llm_call(
                "savings_insights_agent",
                os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
                inp_tok, out_tok,
                (time.time() - start) * 1000,
                user_id=uid,
                success=True,
            )
            try:
                import re
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                insights = json.loads(json_match.group()) if json_match else [content]
            except Exception:
                insights = [content]

            result = {"insights": insights}
            await cache_set(cache_key, result, ttl=1800)
            return result
        except Exception as exc:
            log_llm_call("savings_insights_agent", os.getenv("OPENROUTER_MODEL", ""), 0, 0,
                         (time.time() - start) * 1000, uid, False, str(exc))
            raise HTTPException(status_code=500, detail=f"Savings insights failed: {exc}")

# 16. GET /api/logs (admin) ---------------------------------------------------
@app.get("/api/logs", tags=["Admin"])
async def get_logs(lines: int = 100):
    """Return last N lines of the API log file."""
    with APICallTimer("/api/logs"):
        log_path = os.path.join(BASE_DIR, "logs", "api.log")
        if not os.path.exists(log_path):
            return {"lines": [], "message": "No log file yet"}
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                all_lines = f.readlines()
            last_lines = all_lines[-lines:]
            parsed = []
            for line in last_lines:
                try:
                    parsed.append(json.loads(line.strip()))
                except Exception:
                    parsed.append({"raw": line.strip()})
            return {"lines": parsed, "total_in_file": len(all_lines)}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Could not read log: {exc}")


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
