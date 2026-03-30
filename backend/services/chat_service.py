# backend/services/chat_service.py
"""
AI chat service — handles user messages via OpenRouter and detects
section-navigation intent to return structured navigation hints.
"""

import json
import os
import re
import time
from typing import Optional

import requests

from services.logger import log_llm_call

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

SYSTEM_PROMPT = """You are FinSage AI — a friendly, concise personal finance advisor for Indian professionals.

When answering:
- Be specific, actionable, and reference Indian financial context (₹, EMI, CIBIL, etc.)
- Keep responses under 200 words
- Use bullet points for lists

When the user's message is clearly about one specific section of the app, include a navigation 
hint at the END of your response (after your text) in this exact format:
NAVIGATE_TO: {"label": "Go to Transactions", "route": "/transactions"}

Section routing rules:
- Questions about transactions, expenses, income, spending, payments → route: /transactions
- Questions about loans, EMI, debt, credit score, borrowing → route: /debt-planner
- Questions about goals, targets, saving for something → route: /goals
- Questions about calendar, upcoming payments, schedule, due dates → route: /calendar
- Questions about savings accounts, FD, RD, piggybank, deposits → route: /savings
- Questions about overall finances, summary, net worth, overview → route: /

Only include NAVIGATE_TO if the question is CLEARLY about a specific section.
Do NOT include it for general advice questions.
"""


def chat(
    message: str,
    user_id: Optional[str] = None,
    context: Optional[dict] = None,
) -> dict:
    """
    Send a message to the LLM and return:
      { reply: str, navigation?: { label: str, route: str } }
    """
    if not OPENROUTER_API_KEY:
        return {
            "reply": "⚠️ AI advisor is not configured. Please add OPENROUTER_API_KEY to the backend .env file.",
            "navigation": None,
        }

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add context if provided (e.g. current page)
    if context:
        ctx_str = f"[User context: currently on page '{context.get('currentPage', 'unknown')}']"
        messages.append({"role": "system", "content": ctx_str})

    messages.append({"role": "user", "content": message})

    start = time.time()
    success = True
    error_str = None
    input_tokens = 0
    output_tokens = 0

    try:
        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://finsage.app",
                "X-Title": "FinSage",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": messages,
                "max_tokens": 400,
                "temperature": 0.7,
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        raw_content: str = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        # Parse navigation hint from the end of the response
        navigation = None
        nav_match = re.search(r"NAVIGATE_TO:\s*(\{[^}]+\})", raw_content)
        if nav_match:
            try:
                navigation = json.loads(nav_match.group(1))
            except json.JSONDecodeError:
                navigation = None
            # Strip the NAVIGATE_TO line from the reply
            raw_content = raw_content[: nav_match.start()].rstrip()

        return {"reply": raw_content.strip(), "navigation": navigation}

    except Exception as exc:
        success = False
        error_str = str(exc)
        return {
            "reply": "⚠️ I'm having trouble thinking right now. Please try again in a moment.",
            "navigation": None,
        }

    finally:
        duration_ms = (time.time() - start) * 1000
        log_llm_call(
            agent_name="chat_agent",
            model=OPENROUTER_MODEL,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            duration_ms=duration_ms,
            user_id=user_id,
            success=success,
            error=error_str,
        )
