# backend/summarizer.py (enhanced version)
import os
import json
from typing import Dict, List, Optional
from openai import OpenAI
from datetime import datetime

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def analyze_rfp_enhanced(rfp_text: str, opportunity_data: Dict = None) -> Dict:
    """Enhanced RFP analysis with structured output"""
    
    context = ""
    if opportunity_data:
        context = f"""
        Opportunity Context:
        - Title: {opportunity_data.get('title', '')}
        - Agency: {opportunity_data.get('agency', '')}
        - NAICS: {opportunity_data.get('naics', '')} - {opportunity_data.get('naicsDescription', '')}
        - Set-Aside: {opportunity_data.get('setAsideType', '')}
        - Estimated Value: {opportunity_data.get('estimatedValue', '')}
        - Due Date: {opportunity_data.get('dueDate', '')}
        """
    
    prompt = f"""
    You are an expert government contracting analyst. Analyze this RFP/opportunity and provide actionable insights for a small business contractor.
    
    {context}
    
    Return a JSON response with these exact fields:
    {{
        "executive_summary": "2-3 sentence summary of the opportunity",
        "key_requirements": ["requirement 1", "requirement 2", "requirement 3"],
        "technical_requirements": ["tech requirement 1", "tech requirement 2"],
        "evaluation_criteria": ["criteria 1", "criteria 2", "criteria 3"],
        "compliance_requirements": ["compliance item 1", "compliance item 2"],
        "competitive_landscape": "Assessment of expected competition level and key factors",
        "win_probability": {{"score": "High/Medium/Low", "reasoning": "Brief explanation"}},
        "recommended_actions": ["action 1", "action 2", "action 3"],
        "risk_factors": ["risk 1", "risk 2"],
        "timeline_analysis": "Key dates and milestone analysis",
        "budget_considerations": "Cost and pricing insights"
    }}
    
    RFP Content:
    {rfp_text[:8000] if rfp_text else "No RFP text provided - analyze based on opportunity data only"}
    """
    
    try:
        response = await client.chat.completions.acreate(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2000
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Add metadata
        result["analysis_date"] = datetime.now().isoformat()
        result["opportunity_id"] = opportunity_data.get("id") if opportunity_data else None
        
        return result
        
    except json.JSONDecodeError as e:
        return {
            "error": "Failed to parse AI response",
            "executive_summary": "Analysis failed - invalid response format",
            "key_requirements": ["Unable to analyze"],
            "technical_requirements": ["Unable to analyze"],
            "evaluation_criteria": ["Unable to analyze"],
            "compliance_requirements": ["Unable to analyze"],
            "competitive_landscape": "Unable to assess",
            "win_probability": {"score": "Unknown", "reasoning": "Analysis failed"},
            "recommended_actions": ["Retry analysis"],
            "risk_factors": ["Analysis incomplete"],
            "timeline_analysis": "Unable to analyze",
            "budget_considerations": "Unable to analyze"
        }
    except Exception as e:
        return {
            "error": f"Analysis failed: {str(e)}",
            "executive_summary": "Analysis temporarily unavailable",
            "key_requirements": ["Check back later"],
            "technical_requirements": ["Check back later"],
            "evaluation_criteria": ["Check back later"],
            "compliance_requirements": ["Check back later"],
            "competitive_landscape": "Unable to assess",
            "win_probability": {"score": "Unknown", "reasoning": "Service unavailable"},
            "recommended_actions": ["Try again later"],
            "risk_factors": ["Service interruption"],
            "timeline_analysis": "Unable to analyze",
            "budget_considerations": "Unable to analyze"
        }


def summarize_rfp(rfp_text: str) -> Dict:
    """Legacy function for backward compatibility"""
    import asyncio
    return asyncio.run(analyze_rfp_enhanced(rfp_text))
    
