
from fastapi import FastAPI

app = FastAPI(
    title="EnterpriseIQ API",
    description="Enterprise Knowledge Intelligence Platform",
    version="0.1.0"
)


@app.get("/")
async def root():
    return {
        "project": "EnterpriseIQ",
        "message": "Enterprise Knowledge Intelligence API",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "enterpriseiq-api",
        "version": "0.1.0"
    }
