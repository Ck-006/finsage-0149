# agents/goal_tracker_agent.py
from crewai import Agent, Task
from tools.finance_tools import goal_gap_tool
from config.llm import finsage_llm

goal_tracker_agent = Agent(
    role="Financial Goal Planning Advisor",
    goal=(
        "Evaluate a user's progress toward each defined financial goal. "
        "Compare the required monthly savings rate against actual contributions, "
        "surface the ₹ gap or surplus per goal, and recommend the best-fit "
        "Indian savings instrument (SIP, RD, liquid MF, FD) for each goal's "
        "time horizon and risk profile."
    ),
    backstory=(
        "You are a SEBI-registered investment advisor (RIA) with 8 years of experience "
        "at a Hyderabad-based wealth management firm. You specialize in goal-based "
        "financial planning for Indian salaried professionals — from building ₹1L "
        "emergency funds to planning ₹50L home loan down payments. "
        "You understand that in India, short-term goals (<2 years) suit liquid MFs or RDs, "
        "medium-term goals (2–5 years) suit debt + hybrid MFs, and long-term goals "
        "(>5 years) suit equity SIPs. You always factor in Indian inflation (~5.5% p.a.) "
        "when calculating real purchasing power of future savings."
    ),
    tools=[goal_gap_tool],
    llm=finsage_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=4,
)

goal_tracker_task = Task(
    description=(
        "Using the goals data from the Data Ingestion Agent and savings rate from "
        "the Expense Analyst Agent, evaluate all financial goals.\n\n"
        "Goals JSON:\n{goals_json}\n"
        "Current Monthly Savings Capacity: ₹{monthly_savings_capacity}\n"
        "User Risk Profile: {risk_profile}\n\n"
        "Your tasks:\n"
        "1. Use the GoalGapTool to calculate required vs. actual monthly contribution.\n"
        "2. Flag each goal as 🟢 ON TRACK, 🟡 MARGINAL (gap ≤10%), or 🔴 AT RISK.\n"
        "3. For AT RISK goals, suggest either:\n"
        "   a. Increased monthly contribution needed (₹ amount), OR\n"
        "   b. Revised realistic deadline if contribution cannot change\n"
        "4. For each goal, recommend the most suitable Indian instrument:\n"
        "   - <12 months: Liquid MF or high-yield savings account\n"
        "   - 1–3 years: RD or Short-duration debt MF\n"
        "   - 3–7 years: Balanced Advantage MF or SIP\n"
        "   - >7 years: Equity SIP (Nifty 50 / Flexi-cap MF)\n"
        "5. Check if total required contributions exceed monthly savings capacity — "
        "   if yes, propose goal prioritization order.\n"
        "6. Adjust target amounts for Indian inflation (5.5% p.a.) where deadline > 2 years."
    ),
    expected_output=(
        "A goal tracking report with:\n"
        "- Per-goal status (🟢/🟡/🔴) with ₹ gap or surplus per month\n"
        "- Recommended instrument per goal with expected returns benchmark\n"
        "- Inflation-adjusted target amounts for long-term goals\n"
        "- Goal prioritization order if savings capacity is insufficient\n"
        "- Revised deadlines for AT RISK goals (if contribution is fixed)\n"
        "- Overall Goal Achievement Score: X/100"
    ),
    agent=goal_tracker_agent,
)