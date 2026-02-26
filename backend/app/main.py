"""FastAPI application entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.middleware.error_handler import setup_error_handlers
# Import all models to ensure they're registered with SQLAlchemy
from app.models import Tenant, User, RecordingSession, Transcript, Speaker, SpeakerSegment


# Create FastAPI application – disable interactive docs in production
_is_prod = settings.ENVIRONMENT == "production"

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Audio Transcript API with authentication and multi-tenancy support",
    docs_url=None if _is_prod else "/api/docs",
    redoc_url=None if _is_prod else "/api/redoc",
    openapi_url=None if _is_prod else "/api/openapi.json"
)

# Setup CORS – only allow the methods and headers actually needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=[m.strip() for m in settings.ALLOWED_METHODS.split(",")],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# Setup error handlers
setup_error_handlers(app)

# Include API router
app.include_router(api_router)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "message": "Audio Transcript API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
