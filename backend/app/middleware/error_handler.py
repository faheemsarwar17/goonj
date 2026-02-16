"""Global error handler middleware"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.core.exceptions import AppException


async def error_handler_middleware(request: Request, call_next):
    """
    Global error handler middleware
    Catches application exceptions and returns appropriate JSON responses
    """
    try:
        response = await call_next(request)
        return response
    except AppException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={
                "detail": e.message,
                "status_code": e.status_code,
                "details": e.details
            }
        )
    except Exception as e:
        # Log unexpected errors
        print(f"Unexpected error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "status_code": 500
            }
        )


def setup_error_handlers(app):
    """
    Setup exception handlers for the FastAPI app
    
    Args:
        app: FastAPI application instance
    """
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.message,
                "status_code": exc.status_code,
                "details": exc.details
            }
        )
