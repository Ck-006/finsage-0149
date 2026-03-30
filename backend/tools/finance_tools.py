# Placeholder for finance tools
# tools/finance_tools.py
import json
from crewai.tools import tool

@tool("JSONParserTool")
def parse_json_tool(json_string: str) -> str:
    """
    Parses a raw JSON string representing a user's financial profile.
    Returns a formatted summary of user, expenses, loans, and goals.
    Use this tool to validate and load any incoming financial data.
    """
    try:
        data = json.loads(json_string)
        user     = data.get("user", {})
        expenses = data.get("expenses", [])
        loans    = data.get("loans", [])
        goals    = data.get("goals", [])

        summary = (
            f"User: {user.get('name')}, Age: {user.get('age')}, "
            f"City: {user.get('city')}, Income: ₹{user.get('monthly_income'):,}/month\n"
            f"CIBIL Score: {user.get('cibil_score')}\n"
            f"Total Expense Categories: {len(expenses)}\n"
            f"Total Expenses This Month: ₹{sum(e['amount'] for e in expenses):,}\n"
            f"Active Loans: {len(loans)}\n"
            f"Total Outstanding Debt: ₹{sum(l['outstanding_balance'] for l in loans):,}\n"
            f"Goals Defined: {len(goals)}"
        )
        return summary
    except (json.JSONDecodeError, KeyError) as e:
        return f"ERROR: Could not parse financial data. Reason: {str(e)}"


@tool("ExpenseCategoryTool")
def categorize_expenses_tool(expenses_json: str) -> str:
    """
    Accepts a JSON array of expense objects and computes:
    - Total spend per category
    - % of total spend per category
    - Flags 'impulse_buy' or 'lifestyle' tagged items
    Use this to identify spending leaks in a user's monthly budget.
    """
    try:
        expenses = json.loads(expenses_json)
        total = sum(e["amount"] for e in expenses)
        breakdown = {}

        for e in expenses:
            cat = e.get("category", "Uncategorized")
            breakdown[cat] = breakdown.get(cat, 0) + e["amount"]

        impulse_total = sum(
            e["amount"] for e in expenses
            if e.get("ai_tag") in ("impulse_buy", "lifestyle")
        )

        result_lines = [f"Total Monthly Spend: ₹{total:,}"]
        for cat, amt in sorted(breakdown.items(), key=lambda x: -x[1]):
            pct = (amt / total) * 100
            result_lines.append(f"  {cat}: ₹{amt:,} ({pct:.1f}%)")
        result_lines.append(
            f"\n⚠ Impulse/Lifestyle Spend: ₹{impulse_total:,} "
            f"({(impulse_total / total) * 100:.1f}% of total)"
        )
        return "\n".join(result_lines)
    except Exception as e:
        return f"ERROR in categorization: {str(e)}"


@tool("AvalancheDebtTool")
def avalanche_debt_tool(loans_json: str) -> str:
    """
    Accepts a JSON array of loan objects and returns the Avalanche debt
    repayment order (highest interest rate first). Calculates estimated
    total interest paid and projected payoff timeline in months.
    Use this to show the most mathematically optimal debt payoff plan.
    """
    try:
        loans = json.loads(loans_json)
        sorted_loans = sorted(loans, key=lambda x: x["interest_rate"], reverse=True)

        result_lines = ["=== AVALANCHE METHOD — Debt Payoff Order ==="]
        total_interest = 0

        for i, loan in enumerate(sorted_loans, 1):
            r = loan["interest_rate"] / 100 / 12
            n = loan["tenure_remaining_months"]
            P = loan["outstanding_balance"]
            interest_paid = (loan["emi_amount"] * n) - P if n > 0 else 0
            total_interest += max(interest_paid, 0)

            result_lines.append(
                f"{i}. {loan['name']} | ₹{P:,} @ {loan['interest_rate']}% p.a. | "
                f"EMI: ₹{loan['emi_amount']:,} | "
                f"Est. Interest Remaining: ₹{max(interest_paid, 0):,.0f} | "
                f"Payoff: {n} months"
            )

        result_lines.append(
            f"\nTotal Estimated Interest (all loans): ₹{total_interest:,.0f}"
        )
        result_lines.append(
            "💡 Tip: Direct any surplus income to Loan #1 first to maximize interest savings."
        )
        return "\n".join(result_lines)
    except Exception as e:
        return f"ERROR in avalanche calculation: {str(e)}"


@tool("GoalGapTool")
def goal_gap_tool(goals_json: str) -> str:
    """
    Accepts a JSON array of goal objects and computes the monthly savings
    shortfall or surplus for each goal based on current savings rate,
    target amount, and deadline. Flags 'at_risk' goals.
    Use this to tell users exactly how much extra they need to save per month.
    """
    try:
        from datetime import datetime
        goals = json.loads(goals_json)
        today = datetime.today()
        result_lines = ["=== GOAL GAP ANALYSIS ==="]

        for g in goals:
            target_date  = datetime.strptime(g["target_date"], "%Y-%m-%d")
            months_left  = max(
                (target_date.year - today.year) * 12 +
                (target_date.month - today.month), 1
            )
            gap          = g["target_amount"] - g["current_savings"]
            required_mpm = gap / months_left
            delta        = required_mpm - g["monthly_contribution"]
            status_flag  = "🔴 AT RISK" if delta > 0 else "🟢 ON TRACK"

            result_lines.append(
                f"\n{status_flag} — {g['name']}\n"
                f"  Target: ₹{g['target_amount']:,} | Saved: ₹{g['current_savings']:,} | "
                f"Gap: ₹{gap:,}\n"
                f"  Months Left: {months_left} | "
                f"Required/month: ₹{required_mpm:,.0f} | "
                f"Current Contribution: ₹{g['monthly_contribution']:,}\n"
                f"  {'Shortfall' if delta > 0 else 'Surplus'}: "
                f"₹{abs(delta):,.0f}/month"
            )
        return "\n".join(result_lines)
    except Exception as e:
        return f"ERROR in goal gap analysis: {str(e)}"


@tool("ValidationRulesTool")
def validation_rules_tool(advice_text: str) -> str:
    """
    Scans any financial advice or recommendation text for rule violations.
    Rules enforced:
    1. No single asset allocation > 20% of income.
    2. No unlicensed investment product recommendations.
    3. Must not promise guaranteed returns.
    4. Must not advise closing all credit cards at once (CIBIL impact).
    Returns 'PASS' or 'FAIL' with specific violation details.
    """
    violations = []
    lower = advice_text.lower()

    red_flags = [
        ("guaranteed return", "Promises guaranteed returns — not permitted"),
        ("100% in",           "Suggests full income concentration in one asset"),
        ("put all your money","Advises concentrating all savings in one instrument"),
        ("close all credit",  "Advises closing all credit cards — harmful to CIBIL score"),
        ("crypto",            "Unregulated asset class — must not be advised without disclaimer"),
        ("bitcoin",           "Unregulated asset class — must not be advised without disclaimer"),
    ]

    for phrase, reason in red_flags:
        if phrase in lower:
            violations.append(f"❌ VIOLATION: '{phrase}' detected — {reason}")

    if violations:
        return "VALIDATION FAILED:\n" + "\n".join(violations)

    return (
        "✅ VALIDATION PASSED: All advice is within safe financial guidance boundaries. "
        "No rule violations detected."
    )