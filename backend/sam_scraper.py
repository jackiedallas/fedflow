# backend/sam_scraper.py

import os
from dotenv import load_dotenv
import requests
from datetime import datetime, timedelta
from typing import List

load_dotenv()  # Load .env file

SAM_API_BASE = "https://api.sam.gov/opportunities/v2/search"
API_KEY = os.getenv("SAM_API_KEY")

def fetch_recent_opportunities(days_back: int = 7, limit: int = 20) -> List[dict]:
    if not API_KEY:
        raise ValueError("SAM_API_KEY not set in environment.")

    start_date = (datetime.utcnow() - timedelta(days=days_back)).strftime('%Y-%m-%dT%H:%M:%SZ')

    params = {
        "api_key": API_KEY,
        "noticeType": "Presolicitation,Combined Synopsis/Solicitation,Solicitation",
        "postedFrom": start_date,
        "limit": limit,
        "sort": "date",
        "sortOrder": "desc",
    }

    response = requests.get(SAM_API_BASE, params=params)
    response.raise_for_status()
    data = response.json()
    results = data.get("opportunitiesData", [])

    return [{
        "title": item.get("title"),
        "agency": item.get("departmentName"),
        "naics": item.get("naicsCode"),
        "solicitationNumber": item.get("solicitationNumber"),
        "dueDate": item.get("responseDeadLine"),
        "url": item.get("uiLink"),
        "type": item.get("noticeType"),
    } for item in results]
