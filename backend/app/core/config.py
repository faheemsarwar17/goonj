"""Application configuration using Pydantic Settings"""

from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )
    
    # Application
    APP_NAME: str = "Audio Transcript API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database
    DATABASE_URL: str = Field(
        default="mysql+pymysql://user:password@localhost:3306/audio_transcript",
        description="Database connection URL"
    )
    DATABASE_ECHO: bool = False
    
    # Security
    SECRET_KEY: str = Field(
        default="your-secret-key-here",
        description="Secret key for JWT token generation"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    ALLOWED_ORIGINS: Union[str, List[str]] = "http://localhost:3000"
    ALLOWED_METHODS: str = "GET,POST,PUT,DELETE,OPTIONS"
    ALLOWED_HEADERS: str = "*"
    
    # File Storage
    STORAGE_PATH: str = "./storage"
    MAX_FILE_SIZE_MB: int = 100
    ALLOWED_AUDIO_FORMATS: Union[str, List[str]] = ".wav,.mp3,.m4a,.webm,.ogg"
    
    # AI Services
    OPENAI_API_KEY: str = Field(
        default="",
        description="OpenAI API key for transcription and diarization"
    )
    OPENAI_MODEL: str = "gpt-4o-transcribe-diarize"
    
    # Admin
    FIRST_ADMIN_EMAIL: str = "admin@example.com"
    FIRST_ADMIN_PASSWORD: str = "changeme"
    FIRST_ADMIN_NAME: str = "System Administrator"
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @field_validator("ALLOWED_AUDIO_FORMATS", mode="before")
    @classmethod
    def parse_audio_formats(cls, v):
        if isinstance(v, str):
            return [fmt.strip() for fmt in v.split(",")]
        return v
    
    @property
    def max_file_size_bytes(self) -> int:
        """Convert max file size from MB to bytes"""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


# Global settings instance
settings = Settings()
