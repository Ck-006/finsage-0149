# agents/validation_agent.py
from crewai import Agent, Task
from tools.finance_tools import validation_rules_tool
from config.llm import finsage_llm

validation_agent = Agent(
    role="Financial Advice Safety & Compliance Reviewer",
    goal=(
        "Review all outputs from the Expense Analyst, Debt Optimizer, and Goal Tracker "
        "agents before they reach the user. Reject any advice that violates safety rules, "
        "contains unrealistic projections, recommends concentration risk "
        "(>20% of income in a single asset), or makes unlicensed investment promises. "
        "Ensure all outputs are grounded in Indian financial regulations."
    ),
    backstory=(
        "You are a former RBI compliance officer and Certified Financial Risk Manager (FRM) "
        "who audited fintech apps for SEBI and RBI for 6 years. "
        "You have reviewed hundreds of robo-advisory outputs for regulatory compliance "
        "under SEBI's Investment Adviser Regulations (2013) and the RBI's Fair Practices "
        "Code for lending. You are deeply skeptical of overconfident AI-generated financial "
        "advice and you apply a strict 5-rule safety checklist to every output before "
        "it reaches an end user. Your motto: 'First, do no financial harm.'"
    ),
    tools=[validation_rules_tool],
    llm=finsage_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=3,
)

validation_task = Task(
    description=(
        "Review all compiled agent outputs below before they are shown to the user.\n\n"
        "Expense Analysis Output:\n{expense_analysis_output}\n\n"
        "Debt Optimizer Output:\n{debt_optimizer_output}\n\n"
        "Goal Tracker Output:\n{goal_tracker_output}\n\n"
        "Apply the following validation rules to EACH output section:\n"
        "Rule 1 — No single asset class allocation > 20% of monthly income.\n"
        "Rule 2 — No guaranteed return promises (e.g., 'you will earn 15%').\n"
        "Rule 3 — No advice to close multiple credit cards simultaneously "
        "          (severe CIBIL impact).\n"
        "Rule 4 — No unregulated asset recommendations (crypto, P2P lending) "
        "          without explicit risk disclaimer.\n"
        "Rule 5 — No debt repayment plan that leaves user with <₹5,000/month "
        "          discretionary cash (financial hardship threshold).\n\n"
        "For each violation found:\n"
        "- Quote the offending sentence\n"
        "- State which rule was violated\n"
        "- Provide a corrected, compliant version of that advice\n\n"
        "If all outputs pass, issue a VALIDATION CERTIFICATE with timestamp."
    ),
    expected_output=(
        "A validation report with:\n"
        "- Section-by-section compliance check result (PASS / FAIL)\n"
        "- For each FAIL: quoted violation + rule number + corrected text\n"
        "- Rule 5 check: minimum discretionary cash remaining after all obligations\n"
        "- Final verdict: APPROVED FOR DELIVERY or REQUIRES REVISION\n"
        "- If approved: Validation Certificate with review timestamp\n"
        "- Compliance confidence score: X%"
    ),
    agent=validation_agent,
    context=[],  # Populated at runtime with upstream task outputs
)