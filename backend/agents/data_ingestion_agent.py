# agents/data_ingestion_agent.py
from crewai import Agent, Task
from tools.finance_tools import parse_json_tool
from config.llm import finsage_llm

data_ingestion_agent = Agent(
    role="Financial Data Ingestion Specialist",
    goal=(
        "Parse, validate, and clean a user's uploaded JSON financial profile. "
        "Ensure all fields — income, expenses, loans, goals, and CIBIL score — "
        "are present, correctly typed, and denominated in Indian Rupees (₹). "
        "Flag any missing or anomalous data before passing it downstream."
    ),
    backstory=(
        "You are a meticulous data engineer who spent 5 years at a Bengaluru-based "
        "fintech startup building data pipelines for India's Account Aggregator framework. "
        "You have deep knowledge of Indian financial data formats — UPI transaction logs, "
        "SMS bank alerts, CIBIL report fields, and EMI schedules. "
        "You treat bad data as the root cause of all bad financial advice, "
        "and you never pass incomplete records downstream."
    ),
    tools=[parse_json_tool],
    llm=finsage_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=3,
)

data_ingestion_task = Task(
    description=(
        "You have received the following raw JSON financial profile from a user:\n\n"
        "{raw_user_json}\n\n"
        "Your tasks:\n"
        "1. Use the JSONParserTool to parse and validate the data.\n"
        "2. Confirm all required fields exist: user.monthly_income, user.cibil_score, "
        "   expenses[] with amounts in ₹, loans[] with interest_rate and emi_amount, "
        "   and goals[] with target_amount and target_date.\n"
        "3. Identify and list any missing, null, or suspicious fields "
        "   (e.g., income = 0, negative loan balance).\n"
        "4. Output a clean, structured data summary ready for downstream agents.\n"
        "5. Include a data quality score out of 10."
    ),
    expected_output=(
        "A structured data ingestion report containing:\n"
        "- User profile summary (name, city, income in ₹, CIBIL score)\n"
        "- Expense summary (total categories, total monthly spend in ₹)\n"
        "- Loan summary (count, total outstanding in ₹)\n"
        "- Goals summary (count, total target amount in ₹)\n"
        "- Data Quality Score: X/10\n"
        "- List of any flagged anomalies or missing fields\n"
        "- Status: READY FOR ANALYSIS or REQUIRES USER INPUT"
    ),
    agent=data_ingestion_agent,
)