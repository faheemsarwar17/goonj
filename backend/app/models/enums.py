"""Enumerations for database models"""

from enum import Enum


class UserRole(str, Enum):
    """User role enumeration"""
    ADMIN = "admin"
    USER = "user"


class SessionStatus(str, Enum):
    """Recording session status enumeration"""
    RECORDING = "recording"
    COMPLETED = "completed"
    PROCESSING = "processing"
    FAILED = "failed"


class AudioSource(str, Enum):
    """Audio source type enumeration"""
    DEVICE = "device"
    MICROPHONE = "microphone"
    BOTH = "both"
