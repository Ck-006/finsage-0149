from config.llm import finsage_llm

response = finsage_llm.call(
    messages=[
        {
            "role": "user",
            "content": "Say exactly this and nothing else: OpenRouter connected successfully for FinSage."
        }
    ]
)
print(response)