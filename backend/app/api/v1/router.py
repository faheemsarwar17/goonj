"""API v1 router aggregation"""

from fastapi import APIRouter
from app.api.v1 import auth, admin, users, sessions, transcripts, speakers


api_router = APIRouter(prefix="/api/v1")

# Include all routers
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(users.router)
api_router.include_router(sessions.router)
api_router.include_router(transcripts.router)
api_router.include_router(speakers.router)
