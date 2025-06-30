# backend/main.py
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import asyncio
from sam_scraper import SAMIntegration
from summarizer import analyze_rfp_enhanced
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="GovCon AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SAM integration
sam_client = SAMIntegration(os.getenv("SAM_API_KEY"))

@app.get("/opportunities")
async def get_opportunities(
    days_back: int = Query(7, description="Days to look back for opportunities"),
    limit: int = Query(50, description="Maximum number of opportunities to return"),
    naics: Optional[str] = Query(None, description="Filter by NAICS code"),
    set_aside: Optional[str] = Query(None, description="Filter by set-aside type"),
    agency: Optional[str] = Query(None, description="Filter by agency name"),
    min_value: Optional[int] = Query(None, description="Minimum estimated value"),
    max_value: Optional[int] = Query(None, description="Maximum estimated value")
):
    """Get filtered opportunities from SAM.gov"""
    try:
        opportunities = await sam_client.fetch_opportunities(
            days_back=days_back,
            limit=limit,
            naics_codes=[naics] if naics else None,
            set_aside_types=[set_aside] if set_aside else None,
            agency_filter=agency
        )
        
        # Add match scores (this would be based on user profile in real implementation)
        enhanced_opportunities = []
        for opp in opportunities:
            # Simple match scoring based on keywords and set-aside
            match_score = calculate_basic_match_score(opp)
            opp['matchScore'] = match_score
            enhanced_opportunities.append(opp)
        
        # Sort by match score
        enhanced_opportunities.sort(key=lambda x: x['matchScore'], reverse=True)
        
        return {
            "opportunities": enhanced_opportunities,
            "total": len(enhanced_opportunities),
            "filters_applied": {
                "days_back": days_back,
                "naics": naics,
                "set_aside": set_aside,
                "agency": agency
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch opportunities: {str(e)}")

@app.post("/analyze")
async def analyze_opportunity(request: dict):
    """Analyze an opportunity with AI"""
    try:
        rfp_text = request.get("rfp_text", "")
        opportunity_data = request.get("opportunity_data", {})
        
        if not rfp_text and not opportunity_data:
            raise HTTPException(status_code=400, detail="Either rfp_text or opportunity_data is required")
        
        analysis = await analyze_rfp_enhanced(rfp_text, opportunity_data)
        return analysis
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # In a real implementation, these would come from your database
        opportunities = await sam_client.fetch_opportunities(days_back=30, limit=100)
        
        total_opportunities = len(opportunities)
        high_matches = len([o for o in opportunities if calculate_basic_match_score(o) >= 0.8])
        due_soon = len([o for o in opportunities if days_until_due(o.get('dueDate', '')) <= 14])
        
        return {
            "total_opportunities": total_opportunities,
            "high_matches": high_matches,
            "due_soon": due_soon,
            "saved_count": 0  # Would come from user's saved opportunities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

def calculate_basic_match_score(opportunity: dict) -> float:
    """Basic match scoring algorithm"""
    score = 0.5  # Base score
    
    # Boost for IT-related NAICS codes
    naics = opportunity.get('naics', '')
    if naics.startswith('541512') or naics.startswith('541511') or naics.startswith('518210'):
        score += 0.3
    
    # Boost for SDVOSB set-asides
    set_aside = opportunity.get('setAsideType', '')
    if 'SDVOSB' in set_aside or 'Service-Disabled' in set_aside:
        score += 0.2
    elif 'Small Business' in set_aside:
        score += 0.1
    
    # Keywords that indicate good matches
    title_desc = f"{opportunity.get('title', '')} {opportunity.get('description', '')}".lower()
    high_value_keywords = ['cloud', 'cybersecurity', 'infrastructure', 'modernization', 'digital']
    keyword_matches = sum(1 for keyword in high_value_keywords if keyword in title_desc)
    score += min(0.2, keyword_matches * 0.05)
    
    return min(1.0, score)

def days_until_due(due_date_str: str) -> int:
    """Calculate days until due date"""
    from datetime import datetime
    try:
        due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00'))
        days = (due_date - datetime.now(due_date.tzinfo)).days
        return max(0, days)
    except:
        return 999  # Default to far future if parsing fails