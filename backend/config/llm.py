import os
from crewai import LLM
from dotenv import load_dotenv

load_dotenv()

finsage_llm = LLM(
    model=f"openrouter/{os.getenv('OPENROUTER_MODEL', 'openai/gpt-4o-mini')}",
    base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    api_key=os.getenv("OPENROUTER_API_KEY"),
    temperature=0.3,
    max_tokens=2000,
)