"""Database models package"""

# Import all models here so SQLAlchemy can resolve string-based relationships
from app.models.enums import UserRole, SessionStatus, AudioSource
from app.models.tenant import Tenant
from app.models.user import User
from app.models.session import RecordingSession
from app.models.transcript import Transcript
from app.models.speaker import Speaker
from app.models.speaker_segment import SpeakerSegment

__all__ = [
    "UserRole",
    "SessionStatus",
    "AudioSource",
    "Tenant",
    "User",
    "RecordingSession",
    "Transcript",
    "Speaker",
    "SpeakerSegment",
]
