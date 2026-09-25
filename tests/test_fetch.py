from datetime import datetime, timedelta, timezone

import pytest
import requests

from app.usos.cache import PageCache
from app.usos.fetch import RateLimiter, UsosFetcher, UsosNotFound, UsosUnavailable

BASE = "https://usos.example/kontroler.php"
ACTION = "katalog2/przedmioty/pokazPlanGrupyPrzedmiotow"


class FakeResponse:
    def __init__(self, status=200, text="<html>plan</html>", content_type="text/html; charset=utf-8"):
        self.status_code = status
        self.text = text
        self.headers = {"Content-Type": content_type}
        self.encoding = None


class FakeSession:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.headers = {}
        self.urls = []

    def get(self, url, timeout):
        self.urls.append(url)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class Clock:
    def __init__(self):
        self.now = datetime(2026, 9, 25, 12, tzinfo=timezone.utc)

    def __call__(self):
        return self.now


@pytest.fixture
def clock():
    return Clock()


def fetcher(tmp_path, session, clock):
    return UsosFetcher(
        BASE,
        PageCache(tmp_path / "cache.sqlite3"),
        max_age=timedelta(hours=24),
        limiter=RateLimiter(0),
        timeout=5,
        user_agent="test",
        session=session,
        now=clock,
        sleep=lambda _: None,
    )


def test_url_matches_usos_link_format(tmp_path, clock):
    f = fetcher(tmp_path, FakeSession(), clock)
    assert f.url_for(ACTION, grupa_kod="240-ZBI-1S-2R-Z", cdyd_kod="26/27-Z") == (
        BASE + "?_action=katalog2/przedmioty/pokazPlanGrupyPrzedmiotow"
        "&grupa_kod=240-ZBI-1S-2R-Z&cdyd_kod=26%2F27-Z"
    )


def test_second_request_is_served_from_cache(tmp_path, clock):
    session = FakeSession(FakeResponse())
    f = fetcher(tmp_path, session, clock)
    first = f.get(ACTION, grupa_kod="X")
    clock.now += timedelta(hours=23)
    second = f.get(ACTION, grupa_kod="X")
    assert len(session.urls) == 1
    assert second.html == first.html and second.fetched_at == first.fetched_at


def test_expired_cache_is_refreshed(tmp_path, clock):
    session = FakeSession(FakeResponse(text="stary"), FakeResponse(text="nowy"))
    f = fetcher(tmp_path, session, clock)
    f.get(ACTION, grupa_kod="X")
    clock.now += timedelta(hours=25)
    assert f.get(ACTION, grupa_kod="X").html == "nowy"


def test_stale_copy_is_used_when_usos_is_down(tmp_path, clock):
    down = requests.ConnectionError("down")
    session = FakeSession(FakeResponse(text="stary"), down, down, down)
    f = fetcher(tmp_path, session, clock)
    f.get(ACTION, grupa_kod="X")
    page = f.get(ACTION, refresh=True, grupa_kod="X")
    assert page.stale and page.html == "stary"


def test_error_without_cached_copy_is_raised(tmp_path, clock):
    session = FakeSession(FakeResponse(503), FakeResponse(503), FakeResponse(503))
    with pytest.raises(UsosUnavailable):
        fetcher(tmp_path, session, clock).get(ACTION, grupa_kod="X")
    assert len(session.urls) == 3


def test_server_error_is_retried(tmp_path, clock):
    session = FakeSession(FakeResponse(502), FakeResponse(text="ok"))
    assert fetcher(tmp_path, session, clock).get(ACTION, grupa_kod="X").html == "ok"


def test_not_found_is_not_retried(tmp_path, clock):
    session = FakeSession(FakeResponse(404))
    with pytest.raises(UsosNotFound):
        fetcher(tmp_path, session, clock).get(ACTION, grupa_kod="X")
    assert len(session.urls) == 1


def test_missing_charset_is_read_as_utf8(tmp_path, clock):
    response = FakeResponse(content_type="text/html")
    session = FakeSession(response)
    fetcher(tmp_path, session, clock).get(ACTION, grupa_kod="X")
    assert response.encoding == "utf-8"


def test_rate_limiter_spaces_requests():
    t = [0.0]
    slept = []

    def sleep(seconds):
        slept.append(seconds)
        t[0] += seconds

    limiter = RateLimiter(1.5, clock=lambda: t[0], sleep=sleep)
    limiter.wait()
    t[0] += 0.5
    limiter.wait()
    assert slept == [1.0]
