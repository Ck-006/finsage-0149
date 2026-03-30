# backend/services/logger.py
"""
Structured JSON logger for FinSage API.
Logs every API call and LLM interaction to both console and logs/api.log.
"""

import json
import logging
import os
import time
import uuid


# ── JSON Formatter ────────────────────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data: dict = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        if hasattr(record, "extra"):
            log_data.update(record.extra)  # type: ignore[arg-type]
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)


# ── Logger factory ────────────────────────────────────────────────────────────

def setup_logger(name: str = "finsage") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured — avoid duplicate handlers

    logger.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JSONFormatter())
    logger.addHandler(console_handler)

    os.makedirs("logs", exist_ok=True)
    file_handler = logging.FileHandler("logs/api.log", encoding="utf-8")
    file_handler.setFormatter(JSONFormatter())
    logger.addHandler(file_handler)

    logger.propagate = False
    return logger


api_logger = setup_logger("finsage.api")
llm_logger = setup_logger("finsage.llm")


# ── Logging helpers ───────────────────────────────────────────────────────────

def log_api_call(
    endpoint: str,
    user_id: str | None = None,
    method: str = "GET",
    **kwargs,
) -> str:
    """Log an inbound API call. Returns a request_id for correlation."""
    request_id = str(uuid.uuid4())[:8]
    extra = {
        "extra": {
            "request_id": request_id,
            "endpoint": endpoint,
            "user_id": user_id,
            "method": method,
            **kwargs,
        }
    }
    api_logger.info(f"{method} {endpoint}", extra=extra)
    return request_id


def log_llm_call(
    agent_name: str,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    duration_ms: float = 0.0,
    user_id: str | None = None,
    success: bool = True,
    error: str | None = None,
) -> None:
    """Log every OpenRouter/LLM API call with cost estimate."""
    # Rough cost: $0.15/1M input tokens, $0.60/1M output tokens (GPT-4o-mini pricing)
    cost_estimate = (input_tokens * 0.15 + output_tokens * 0.60) / 1_000_000

    llm_logger.info(
        f"LLM call: {agent_name}",
        extra={
            "extra": {
                "agent": agent_name,
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "duration_ms": round(duration_ms, 2),
                "cost_usd": round(cost_estimate, 6),
                "user_id": user_id,
                "success": success,
                "error": error,
            }
        },
    )


# ── Context manager ────────────────────────────────────────────────────────────

class APICallTimer:
    """Context manager that times and logs an API call."""

    def __init__(self, endpoint: str, user_id: str | None = None, method: str = "GET"):
        self.endpoint = endpoint
        self.user_id = user_id
        self.method = method
        self._start: float = 0.0
        self.request_id: str = ""

    def __enter__(self) -> "APICallTimer":
        self._start = time.time()
        self.request_id = log_api_call(self.endpoint, self.user_id, self.method)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        duration = (time.time() - self._start) * 1000
        status = "error" if exc_type else "success"
        api_logger.info(
            f"Completed {self.endpoint}",
            extra={
                "extra": {
                    "request_id": self.request_id,
                    "duration_ms": round(duration, 2),
                    "status": status,
                    "error": str(exc_val) if exc_val else None,
                }
            },
        )
