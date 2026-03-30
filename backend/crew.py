# crew.py
import json
import os
from crewai import Crew, Process
from config.llm import finsage_llm

from agents.data_ingestion_agent  import data_ingestion_agent,  data_ingestion_task
from agents.expense_analyst_agent import expense_analyst_agent, expense_analyst_task
from agents.debt_optimizer_agent  import debt_optimizer_agent,  debt_optimizer_task
from agents.goal_tracker_agent    import goal_tracker_agent,    goal_tracker_task
from agents.validation_agent      import validation_agent,      validation_task
from agents.explanation_agent     import explanation_agent,     explanation_task

# ─── SECTION 2 — Context wiring ───────────────────────────────────────────────
expense_analyst_task.context = [data_ingestion_task]
debt_optimizer_task.context  = [data_ingestion_task]
goal_tracker_task.context    = [data_ingestion_task, expense_analyst_task]
validation_task.context      = [expense_analyst_task, debt_optimizer_task, goal_tracker_task]
explanation_task.context     = [validation_task]

# ─── SECTION 3 — Crew factory (lazy — avoids ChromaDB check at import time) ───
def _build_crew() -> Crew:
    """
    Instantiate the Crew at call-time, not at module import time.
    This prevents the CHROMA_OPENAI_API_KEY validation error from
    triggering when FastAPI simply imports this module on startup.
    Memory is enabled only when an OpenAI key is present in the environment.
    """
    use_memory = bool(os.getenv("OPENAI_API_KEY"))
    return Crew(
        agents=[
            data_ingestion_agent,
            expense_analyst_agent,
            debt_optimizer_agent,
            goal_tracker_agent,
            validation_agent,
            explanation_agent,
        ],
        tasks=[
            data_ingestion_task,
            expense_analyst_task,
            debt_optimizer_task,
            goal_tracker_task,
            validation_task,
            explanation_task,
        ],
        process=Process.sequential,
        memory=use_memory,   # True only when OPENAI_API_KEY is set
        verbose=True,
        manager_llm=finsage_llm,
        )


# ─── SECTION 4 — Callable wrapper for FastAPI ─────────────────────────────────
def run_finsage_crew(user_data: dict) -> str:
    """
    Main entry point for FinSage analysis.
    Accepts a fully-formed user financial profile dict and returns
    the final FinSage Financial Health Report as a string.

    Args:
        user_data (dict): Parsed JSON financial profile with keys:
                          user, expenses, loans, goals, [risk_profile]

    Returns:
        str: FinSage Financial Health Report or a user-friendly error message.
    """
    try:
        # ── Extract core user fields ──────────────────────────────────────────
        monthly_income  = user_data["user"]["monthly_income"]
        user_first_name = user_data["user"]["name"].split()[0]
        user_city       = user_data["user"]["city"]

        # ── Serialise nested lists to JSON strings for task prompts ───────────
        expenses_json = json.dumps(user_data["expenses"])
        loans_json    = json.dumps(user_data["loans"])
        goals_json    = json.dumps(user_data["goals"])

        # ── Derived financial calculations ────────────────────────────────────
        total_expenses = sum(e["amount"] for e in user_data["expenses"])
        total_emis     = sum(l["emi_amount"] for l in user_data["loans"])

        monthly_surplus          = monthly_income - total_expenses - total_emis
        monthly_savings_capacity = monthly_income - total_expenses

        risk_profile = user_data.get("risk_profile") or user_data["user"].get("risk_profile", "moderate")

        # ── Build inputs dict ─────────────────────────────────────────────────
        inputs = {
            "raw_user_json":            json.dumps(user_data),
            "expenses_json":            expenses_json,
            "loans_json":               loans_json,
            "goals_json":               goals_json,
            "monthly_income":           monthly_income,
            "monthly_surplus":          monthly_surplus,
            "monthly_savings_capacity": monthly_savings_capacity,
            "risk_profile":             risk_profile,
            "user_first_name":          user_first_name,
            "user_city":                user_city,
            "expense_analysis_output":  "",
            "debt_optimizer_output":    "",
            "goal_tracker_output":      "",
            "validated_outputs":        "",
        }

        crew   = _build_crew()
        result = crew.kickoff(inputs=inputs)
        return str(result)

    except KeyError as e:
        return (
            "FinSage is currently unable to analyze this profile. "
            f"Missing required field: {e}. "
            "Please check your data format and try again."
        )
    except Exception:
        return (
            "FinSage is currently unable to analyze this profile. "
            "Please check your data format and try again."
        )


# ─── SECTION 5 — Standalone test block ───────────────────────────────────────
if __name__ == "__main__":
    base_dir   = os.path.dirname(os.path.abspath(__file__))
    user1_path = os.path.join(base_dir, "mock_data", "user1.json")

    print(f"Loading test data from: {user1_path}")
    with open(user1_path, "r", encoding="utf-8") as f:
        test_data = json.load(f)

    print("Running FinSage crew analysis …\n")
    output = run_finsage_crew(test_data)
    print("\n" + "=" * 60)
    print("FINSAGE RESULT:")
    print("=" * 60)
    print(output)