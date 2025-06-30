# backend/summarizer.py

import os
from dotenv import load_dotenv
from openai import OpenAI
from typing import Dict

load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=openai_api_key)

def summarize_rfp(rfp_text: str) -> Dict:
    """Summarizes an RFP using GPT-4-turbo"""
    prompt = f"""
You are a government contracting assistant. Summarize the following RFP for a small business owner.

Return your answer as JSON with the following fields:
- opportunity_title
- agency
- summary
- due_date
- evaluation_criteria
- key_requirements

RFP Content:
{rfp_text}
    """

    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3
    )

    return response.choices[0].message.content
