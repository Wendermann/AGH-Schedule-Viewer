"""Pobieranie stron USOSweb: cache, limit zapytań i ponawianie."""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import requests

from .cache import PageCache


class UsosError(Exception):
    pass


class UsosUnavailable(UsosError):
    """USOS nie odpowiedział albo odpowiedział błędem serwera."""


class UsosNotFound(UsosError):
    pass


@dataclass(frozen=True)
class Page:
    url: str
    html: str
    fetched_at: datetime
    # Kopia z cache, podana dlatego, że odświeżenie się nie udało.
    stale: bool = False


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RateLimiter:
    def __init__(
        self,
        min_interval: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.min_interval = min_interval
        self._clock = clock
        self._sleep = sleep
        self._lock = threading.Lock()
        self._next_allowed = 0.0

    def wait(self) -> None:
        with self._lock:
            delay = self._next_allowed - self._clock()
            if delay > 0:
                self._sleep(delay)
            self._next_allowed = self._clock() + self.min_interval


class UsosFetcher:
    RETRY_DELAYS = (2.0, 6.0)

    def __init__(
        self,
        base_url: str,
        cache: PageCache,
        *,
        max_age: timedelta,
        limiter: RateLimiter,
        timeout: float,
        user_agent: str,
        session: requests.Session | None = None,
        now: Callable[[], datetime] = _utcnow,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.base_url = base_url
        self.cache = cache
        self.max_age = max_age
        self.limiter = limiter
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers["User-Agent"] = user_agent
        self._now = now
        self._sleep = sleep

    def url_for(self, action: str, **params: str | int) -> str:
        # Kolejność i kodowanie jak w linkach samego USOSweb, żeby ta sama
        # strona zawsze trafiała pod ten sam klucz cache.
        query = "_action=" + quote(action, safe="/")
        for name, value in params.items():
            query += f"&{name}={quote(str(value), safe='')}"
        return f"{self.base_url}?{query}"

    def get(self, action: str, *, refresh: bool = False, **params: str | int) -> Page:
        url = self.url_for(action, **params)
        cached = self.cache.get(url)
        if cached and not refresh and self._now() - cached.fetched_at < self.max_age:
            return Page(url, cached.html, cached.fetched_at)

        try:
            html = self._download(url)
        except UsosUnavailable:
            if cached is None:
                raise
            return Page(url, cached.html, cached.fetched_at, stale=True)

        fetched_at = self._now()
        self.cache.put(url, html, fetched_at)
        return Page(url, html, fetched_at)

    def _download(self, url: str) -> str:
        attempts = len(self.RETRY_DELAYS) + 1
        for attempt in range(attempts):
            self.limiter.wait()
            try:
                response = self.session.get(url, timeout=self.timeout)
            except requests.RequestException as exc:
                error: UsosError = UsosUnavailable(str(exc))
            else:
                if response.status_code == 404:
                    raise UsosNotFound(url)
                if response.status_code < 500:
                    if response.status_code >= 400:
                        raise UsosUnavailable(f"HTTP {response.status_code}: {url}")
                    # Bez jawnego charsetu requests przyjmuje ISO-8859-1
                    # i psuje polskie znaki.
                    content_type = response.headers.get("Content-Type", "")
                    if "charset" not in content_type.lower():
                        response.encoding = "utf-8"
                    return response.text
                error = UsosUnavailable(f"HTTP {response.status_code}: {url}")
            if attempt < attempts - 1:
                self._sleep(self.RETRY_DELAYS[attempt])
        raise error
