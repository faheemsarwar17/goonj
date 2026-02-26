"""Simple in-memory rate limiter for auth endpoints"""

import time
from collections import defaultdict
from fastapi import Request, HTTPException, status


class RateLimiter:
    """
    Token-bucket style rate limiter keyed by client IP.
    Designed for auth endpoints to prevent brute-force attacks.
    """

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # {ip: [timestamp, ...]}
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _prune(self, key: str) -> None:
        cutoff = time.monotonic() - self.window_seconds
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]

    def check(self, request: Request) -> None:
        """Raise 429 if the caller exceeded the rate limit."""
        ip = self._get_client_ip(request)
        self._prune(ip)
        if len(self._hits[ip]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )
        self._hits[ip].append(time.monotonic())


# Shared instance: 10 requests per 60 s for auth endpoints
auth_rate_limiter = RateLimiter(max_requests=10, window_seconds=60)
