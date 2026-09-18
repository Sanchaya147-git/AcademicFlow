import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api.routes import router
from app.config import settings
from app.extraction.extractor import ProviderError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("academicflow")
app = FastAPI(title="AcademicFlow API", version="0.2.0", description="AI-assisted academic execution intelligence")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(router)


@app.middleware("http")
async def request_log(request: Request, call_next):
    request_id = uuid.uuid4().hex
    start = time.monotonic()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    logger.info(
        "%s %s %s %.3fs request=%s",
        request.method,
        request.url.path,
        response.status_code,
        time.monotonic() - start,
        request_id,
    )
    return response


@app.exception_handler(IntegrityError)
async def integrity_error(request, error):
    return JSONResponse(
        status_code=409, content={"detail": "Operation conflicts with existing data or database constraints"}
    )


@app.exception_handler(OperationalError)
async def database_error(request, error):
    logger.error("Database operation unavailable: %s", type(error).__name__)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable; check configuration and migrations"})


@app.exception_handler(ProviderError)
async def provider_error(request, error):
    logger.warning("AI provider operation failed")
    return JSONResponse(status_code=502, content={"detail": str(error)})


@app.get("/health", tags=["Health"])
def health_check() -> dict:
    return {"status": "ok"}
