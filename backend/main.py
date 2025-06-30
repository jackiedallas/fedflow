from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from sam_scraper import fetch_recent_opportunities


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/opportunities")
def get_opportunities():
    return fetch_recent_opportunities()

@app.post("/summarize")
def summarize_rfp_endpoint(rfp_text: str = Body(..., embed=True)):
    from summarizer import summarize_rfp
    return summarize_rfp(rfp_text)
