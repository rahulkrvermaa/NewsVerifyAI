from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import get_settings
from database import init_db
from routes.analysis import router as analysis_router
from routes.articles import router as articles_router
from routes.evidence import router as evidence_router
from routes.history import router as history_router

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="NewsVerify AI API",
    description="AI-Powered News Authenticity & Proposition Verification Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles_router)
app.include_router(analysis_router)
app.include_router(history_router)
app.include_router(evidence_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "NewsVerify AI"}


@app.get("/api/config/status")
def config_status():
    """Return non-secret configuration status so the UI can report missing credentials."""
    return {
        "llm_configured": settings.llm_configured,
        "tavily_configured": settings.tavily_configured,
        "llm_model": settings.LLM_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL,
        "nli_model": settings.NLI_MODEL,
        "spacy_model": settings.SPACY_MODEL,
        "max_upload_mb": settings.MAX_UPLOAD_MB,
    }
