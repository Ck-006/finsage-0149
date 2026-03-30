# agents/debt_optimizer_agent.py
from crewai import Agent, Task
from tools.finance_tools import avalanche_debt_tool
from config.llm import finsage_llm

debt_optimizer_agent = Agent(
    role="Debt Repayment Strategist",
    goal=(
        "Rank all of a user's active loans using the Avalanche method (highest APR first) "
        "to minimize total interest paid. Calculate total interest savings versus minimum "
        "payment strategy, model the impact of prepayments, and provide a month-by-month "
        "debt-free countdown. Flag credit card debt at ≥30% APR as CRITICAL PRIORITY."
    ),
    backstory=(
        "You are a debt resolution specialist who built the EMI optimizer engine at a "
        "leading Indian NBFC. You have helped thousands of Indian borrowers across "
        "home loans, car loans, personal loans, and revolving credit card debt navigate "
        "the complex web of Indian lending rates — which range from 6.5% (home loans) "
        "to 42% (credit cards with late fees). "
        "You believe credit card revolving debt at 36% APR is the single biggest "
        "financial threat to Indian millennials, and you always address it first. "
        "You explain both Avalanche (mathematical optimum) and Snowball (psychological "
        "wins) methods and let the user choose, but you always show the interest cost "
        "difference between the two."
    ),
    tools=[avalanche_debt_tool],
    llm=finsage_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=4,
)

debt_optimizer_task = Task(
    description=(
        "Using the loan data from the Data Ingestion Agent, build a complete "
        "debt repayment optimization plan.\n\n"
        "Loans JSON:\n{loans_json}\n"
        "Monthly Surplus Available for Extra Repayment: ₹{monthly_surplus}\n\n"
        "Your tasks:\n"
        "1. Use the AvalancheDebtTool to rank debts by interest rate.\n"
        "2. Identify any credit card debt ≥30% APR — mark as 🚨 CRITICAL.\n"
        "3. Calculate total interest paid under:\n"
        "   a. Minimum payment only strategy\n"
        "   b. Avalanche method with ₹{monthly_surplus} extra monthly\n"
        "   c. Snowball method (lowest balance first) for comparison\n"
        "4. Show interest saved (Avalanche vs. minimum payments) in ₹.\n"
        "5. Build a simplified month-by-month payoff timeline for the top-priority debt.\n"
        "6. Calculate post-debt-clearance monthly cash flow improvement in ₹.\n"
        "7. Recommend whether to prepay or invest surplus based on loan interest rate "
        "   vs. expected SIP returns (benchmark: 12% equity MF XIRR)."
    ),
    expected_output=(
        "A debt optimization report containing:\n"
        "- Debt ranked list (Avalanche order) with interest rates and outstanding balances\n"
        "- CRITICAL flags for any debt ≥30% APR\n"
        "- Interest savings: Avalanche vs. minimum payment (₹ difference)\n"
        "- Interest savings: Avalanche vs. Snowball (₹ difference)\n"
        "- Debt-free date under each strategy (month + year)\n"
        "- Month-by-month payoff plan for Priority #1 debt\n"
        "- Post-clearance monthly cash flow gain in ₹\n"
        "- Prepay vs. Invest recommendation with rationale\n"
        "- Debt Load Score: X/100 (100 = completely debt-free)"
    ),
    agent=debt_optimizer_agent,
)


# ─── Standalone helper functions (used by FastAPI /debt-plan endpoint) ─────────


def calculate_avalanche_plan(loans: list, monthly_surplus: int) -> str:
    """
    Pure-Python Avalanche debt payoff plan (highest APR first).
    Sorts loans by descending interest rate, applies monthly_surplus
    as an extra payment to the top-priority loan each month.
    Returns a formatted summary string.
    """
    if not loans:
        return "No loans provided. You are debt-free! 🎉"

    sorted_loans = sorted(loans, key=lambda x: x["interest_rate"], reverse=True)
    lines = ["=== AVALANCHE PLAN (Highest Interest First) ===\n"]
    total_interest_saved = 0

    for i, loan in enumerate(sorted_loans, 1):
        P = loan["outstanding_balance"]
        r = loan["interest_rate"] / 100 / 12
        emi = loan["emi_amount"]
        n = loan["tenure_remaining_months"]

        # Baseline interest (min payments only)
        baseline_interest = max((emi * n) - P, 0)

        # Extra payment applied to top-priority loan only
        extra = monthly_surplus if i == 1 else 0
        effective_emi = emi + extra

        # Recalculate months to payoff with extra payment
        if r > 0 and effective_emi > P * r:
            import math
            new_n = math.ceil(
                -math.log(1 - (P * r) / effective_emi) / math.log(1 + r)
            )
        else:
            new_n = n

        new_interest = max((effective_emi * new_n) - P, 0)
        saved = baseline_interest - new_interest
        total_interest_saved += max(saved, 0)

        priority_flag = " 🚨 CRITICAL" if loan["interest_rate"] >= 30 else ""
        lines.append(
            f"Priority #{i}{priority_flag} — {loan['name']}\n"
            f"  Outstanding: ₹{P:,}  |  Rate: {loan['interest_rate']}% p.a.\n"
            f"  Base EMI: ₹{emi:,}  |  Extra Payment: ₹{extra:,}\n"
            f"  Payoff: {new_n} months (was {n} months)\n"
            f"  Interest Saved vs. Min Payments: ₹{max(saved, 0):,.0f}\n"
        )

    lines.append(f"\n💰 Total Interest Saved (Avalanche): ₹{total_interest_saved:,.0f}")
    lines.append("Strategy: Mathematically optimal — minimises total interest paid.")
    return "\n".join(lines)


def calculate_snowball_plan(loans: list, monthly_surplus: int) -> str:
    """
    Pure-Python Snowball debt payoff plan (lowest balance first).
    Sorts loans by ascending outstanding balance for psychological quick wins.
    Returns a formatted summary string.
    """
    if not loans:
        return "No loans provided. You are debt-free! 🎉"

    sorted_loans = sorted(loans, key=lambda x: x["outstanding_balance"])
    lines = ["=== SNOWBALL PLAN (Lowest Balance First) ===\n"]

    for i, loan in enumerate(sorted_loans, 1):
        P = loan["outstanding_balance"]
        r = loan["interest_rate"] / 100 / 12
        emi = loan["emi_amount"]
        n = loan["tenure_remaining_months"]

        extra = monthly_surplus if i == 1 else 0
        effective_emi = emi + extra

        if r > 0 and effective_emi > P * r:
            import math
            new_n = math.ceil(
                -math.log(1 - (P * r) / effective_emi) / math.log(1 + r)
            )
        else:
            new_n = n

        lines.append(
            f"Priority #{i} — {loan['name']}\n"
            f"  Outstanding: ₹{P:,}  |  Rate: {loan['interest_rate']}% p.a.\n"
            f"  Base EMI: ₹{emi:,}  |  Extra Payment: ₹{extra:,}\n"
            f"  Payoff: {new_n} months (was {n} months)\n"
        )

    lines.append("\n🧠 Strategy: Psychological wins — clear smallest debts first to build momentum.")
    lines.append(
        "⚠️  Note: Snowball typically pays MORE total interest than Avalanche. "
        "Check the Avalanche plan to see your potential savings."
    )
    return "\n".join(lines)