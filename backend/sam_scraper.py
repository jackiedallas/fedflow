# backend/sam_scraper.py (FIXED VERSION)

import os
from dotenv import load_dotenv
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import re

load_dotenv()

class SAMIntegration:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.sam.gov/opportunities/v2"
        
    async def fetch_opportunities(
        self,
        days_back: int = 7,
        limit: int = 50,
        naics_codes: Optional[List[str]] = None,
        set_aside_types: Optional[List[str]] = None,
        agency_filter: Optional[str] = None
    ) -> List[Dict]:
        """Enhanced opportunity fetching with filtering"""
        
        # SAM.gov requires BOTH PostedFrom AND PostedTo
        start_date = (datetime.utcnow() - timedelta(days=days_back)).strftime('%Y-%m-%dT%H:%M:%SZ')
        end_date = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')  # Today
        
        params = {
            "api_key": self.api_key,
            "noticeType": "Presolicitation,Combined Synopsis/Solicitation,Solicitation",
            "postedFrom": start_date,
            "postedTo": end_date,  # This was missing!
            "limit": limit,
            "sort": "date",
            "sortOrder": "desc",
        }
        
        if naics_codes:
            params["naicsCode"] = ",".join(naics_codes)
        if set_aside_types:
            # Map common set-aside terms to SAM.gov values
            set_aside_mapping = {
                "SDVOSB": "Service-Disabled Veteran-Owned Small Business",
                "WOSB": "Women-Owned Small Business",
                "HubZone": "HubZone Small Business",
                "Small Business": "Small Business Set-Aside"
            }
            mapped_types = [set_aside_mapping.get(t, t) for t in set_aside_types]
            params["setAside"] = ",".join(mapped_types)
        
        print(f"SAM.gov API Request:")
        print(f"URL: {self.base_url}/search")
        print(f"Params: {params}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/search", params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        opportunities = self._parse_opportunities(data.get("opportunitiesData", []))
                        print(f"Successfully fetched {len(opportunities)} opportunities from SAM.gov")
                        
                        # Apply agency filter if specified
                        if agency_filter:
                            opportunities = [
                                opp for opp in opportunities 
                                if agency_filter.lower() in opp.get('agency', '').lower()
                            ]
                        
                        return opportunities
                    else:
                        error_text = await response.text()
                        print(f"SAM.gov API error: {response.status}")
                        print(f"Error details: {error_text}")
                        return self._get_fallback_data()
        except Exception as e:
            print(f"Error fetching from SAM.gov: {e}")
            return self._get_fallback_data()
    
    def _parse_opportunities(self, raw_data: List[Dict]) -> List[Dict]:
        """Enhanced parsing with more fields and data cleaning"""
        opportunities = []
        
        for item in raw_data:
            # Extract and clean estimated value
            estimated_value = self._parse_estimated_value(item)
            
            # Parse contact information
            contacts = item.get("pointOfContact", [])
            primary_contact = contacts[0] if contacts else {}
            
            # Clean and structure the opportunity data
            opportunity = {
                "id": item.get("noticeId", item.get("solicitationNumber", "")),
                "title": self._clean_text(item.get("title", "")),
                "agency": self._clean_text(item.get("departmentName", "")),
                "office": self._clean_text(item.get("subTier", "")),
                "solicitationNumber": item.get("solicitationNumber", ""),
                "naics": item.get("naicsCode", ""),
                "naicsDescription": self._clean_text(item.get("naicsCodeDescription", "")),
                "setAsideType": self._parse_set_aside(item.get("typeOfSetAside", "")),
                "dueDate": item.get("responseDeadLine", ""),
                "postedDate": item.get("postedDate", ""),
                "estimatedValue": estimated_value,
                "placeOfPerformance": self._parse_location(item.get("placeOfPerformance", {})),
                "description": self._clean_text(item.get("description", "")),
                "url": item.get("uiLink", ""),
                "type": item.get("noticeType", ""),
                "contactInfo": {
                    "name": self._clean_text(primary_contact.get("fullName", "")),
                    "email": primary_contact.get("email", ""),
                    "phone": self._clean_phone(primary_contact.get("phone", ""))
                },
                "additionalInfo": {
                    "classificationCode": item.get("classificationCode", ""),
                    "organizationType": item.get("organizationType", ""),
                    "state": item.get("state", "")
                }
            }
            
            opportunities.append(opportunity)
        
        return opportunities
    
    def _parse_estimated_value(self, item: Dict) -> str:
        """Extract and format estimated contract value"""
        # Try multiple fields where value might be stored
        value_fields = [
            item.get("award", {}).get("amount"),
            item.get("estimatedValue"),
            item.get("baseAndAllOptionsValue")
        ]
        
        for value in value_fields:
            if value:
                # Clean and format the value
                if isinstance(value, (int, float)):
                    return self._format_currency(value)
                elif isinstance(value, str):
                    # Extract numbers from string
                    numbers = re.findall(r'\$?[\d,]+', value)
                    if numbers:
                        try:
                            num = int(numbers[0].replace(',', '').replace('$', ''))
                            return self._format_currency(num)
                        except:
                            pass
        
        # Check description for value hints
        description = item.get("description", "")
        value_patterns = [
            r'\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M|billion|B))?',
            r'[\d,]+(?:\.\d{2})?\s*(?:million|M|billion|B)\s*dollars?',
        ]
        
        for pattern in value_patterns:
            matches = re.findall(pattern, description, re.IGNORECASE)
            if matches:
                return f"~{matches[0]}"
        
        return "Not specified"
    
    def _format_currency(self, amount: float) -> str:
        """Format currency amount"""
        if amount >= 1_000_000_000:
            return f"${amount/1_000_000_000:.1f}B"
        elif amount >= 1_000_000:
            return f"${amount/1_000_000:.1f}M"
        elif amount >= 1_000:
            return f"${amount/1_000:.0f}K"
        else:
            return f"${amount:,.0f}"
    
    def _parse_set_aside(self, set_aside_text: str) -> str:
        """Parse and normalize set-aside type"""
        if not set_aside_text:
            return "Open Competition"
        
        # Normalize common set-aside types
        set_aside_lower = set_aside_text.lower()
        
        if "service-disabled" in set_aside_lower or "sdvosb" in set_aside_lower:
            return "SDVOSB"
        elif "women-owned" in set_aside_lower or "wosb" in set_aside_lower:
            return "WOSB"
        elif "hubzone" in set_aside_lower:
            return "HubZone"
        elif "small business" in set_aside_lower:
            return "Small Business"
        elif "8(a)" in set_aside_text:
            return "8(a)"
        else:
            return set_aside_text
    
    def _parse_location(self, location_data: Dict) -> str:
        """Parse place of performance location"""
        if not location_data:
            return "Not specified"
        
        # Try different location field structures
        city_data = location_data.get("city", {})
        if isinstance(city_data, dict):
            city = city_data.get("name", "")
            state = location_data.get("state", {}).get("name", "")
            if city and state:
                return f"{city}, {state}"
            elif city:
                return city
        
        # Fallback to string representation
        return str(location_data.get("city", "Not specified"))
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text fields"""
        if not text:
            return ""
        
        # Remove extra whitespace and normalize
        cleaned = re.sub(r'\s+', ' ', text.strip())
        
        # Remove common HTML entities
        html_entities = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'"
        }
        
        for entity, replacement in html_entities.items():
            cleaned = cleaned.replace(entity, replacement)
        
        return cleaned
    
    def _clean_phone(self, phone: str) -> str:
        """Clean and format phone numbers"""
        if not phone:
            return ""
        
        # Extract digits only
        digits = re.sub(r'\D', '', phone)
        
        # Format as (XXX) XXX-XXXX if 10 digits
        if len(digits) == 10:
            return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == '1':
            return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        else:
            return phone  # Return original if can't parse
    
    def _get_fallback_data(self) -> List[Dict]:
        """Return fallback mock data when API fails"""
        return [
            {
                "id": "fallback-1",
                "title": "IT Infrastructure Modernization Services",
                "agency": "Department of Veterans Affairs",
                "office": "Office of Information Technology",
                "solicitationNumber": "36C10G24R0029",
                "naics": "541512",
                "naicsDescription": "Computer Systems Design Services",
                "setAsideType": "SDVOSB",
                "dueDate": (datetime.now() + timedelta(days=21)).isoformat() + "Z",
                "postedDate": datetime.now().isoformat() + "Z",
                "estimatedValue": "$2.5M - $15M",
                "placeOfPerformance": "Washington, DC",
                "description": "The Department of Veterans Affairs is seeking qualified contractors to provide comprehensive IT infrastructure modernization services including cloud migration, cybersecurity implementation, and legacy system integration.",
                "url": "https://sam.gov",
                "type": "Solicitation",
                "contactInfo": {
                    "name": "Sarah Johnson",
                    "email": "sarah.johnson@va.gov",
                    "phone": "(202) 555-0123"
                },
                "additionalInfo": {
                    "classificationCode": "R",
                    "organizationType": "Federal Agency",
                    "state": "DC"
                }
            },
            {
                "id": "fallback-2", 
                "title": "Cybersecurity Assessment and Penetration Testing",
                "agency": "Department of Homeland Security",
                "office": "Cybersecurity and Infrastructure Security Agency",
                "solicitationNumber": "70RSAT25R00000001",
                "naics": "541690",
                "naicsDescription": "Other Scientific and Technical Consulting Services",
                "setAsideType": "Small Business",
                "dueDate": (datetime.now() + timedelta(days=28)).isoformat() + "Z",
                "postedDate": (datetime.now() - timedelta(days=2)).isoformat() + "Z",
                "estimatedValue": "$500K - $2M",
                "placeOfPerformance": "Multiple Locations",
                "description": "CISA requires comprehensive cybersecurity assessment services including vulnerability assessments, penetration testing, and security compliance audits for critical infrastructure systems.",
                "url": "https://sam.gov",
                "type": "Combined Synopsis/Solicitation",
                "contactInfo": {
                    "name": "Michael Chen",
                    "email": "michael.chen@dhs.gov", 
                    "phone": "(202) 555-0456"
                },
                "additionalInfo": {
                    "classificationCode": "R",
                    "organizationType": "Federal Agency",
                    "state": "DC"
                }
            }
        ]


# Simple function for backward compatibility
def fetch_recent_opportunities(days_back: int = 7, limit: int = 20) -> List[dict]:
    """Simple function that returns opportunities"""
    sam_integration = SAMIntegration(os.getenv("SAM_API_KEY"))
    import asyncio
    return asyncio.run(sam_integration.fetch_opportunities(days_back, limit))