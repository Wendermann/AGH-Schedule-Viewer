"""USOS API: daty spotkań, cykle i słowniki. Metody planu nie wymagają klucza.

Skład grupy przedmiotów i nazwiska prowadzących pochodzą z USOSweb
(`app/usos/web.py`), bo API ich nie udostępnia bez logowania.
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date, datetime, time as clock, timedelta

import requests

from .fetch import RateLimiter, UsosError, UsosUnavailable

# Grupy zajęciowe w jednym tt/classgroups. Idą w treści POST, bo w adresie
# GET mieści się ich niecałe 900 (dłuższy adres kończy się HTTP 414).
# 26.09.2026 zapytanie o 965 grup trwało ok. 1 s.
BATCH = 1000
# Metody tt/* poza classgroup_dates2 zwracają najwyżej 7 dni.
WINDOW_DAYS = 7
MEETING_FIELDS = "type|start_time|end_time|unit_id|group_number|frequency"
# Wyszukiwarki API zwracają najwyżej 100 wyników na zapytanie, więc kierunki
# studiów zbieramy kilkoma węższymi zapytaniami.
SEARCH_LIMIT = 100
PROGRAMME_QUERIES = (
    "pierwszego stopnia, stacjonarne",
    "pierwszego stopnia, niestacjonarne",
    "drugiego stopnia, stacjonarne",
    "drugiego stopnia, niestacjonarne",
)
# Np. 100-IZP-1N-19 albo 240-IDS-2S4-20: wydział, kierunek, stopień i tryb
# (z liczbą semestrów studiów II stopnia), rocznik programu.
PROGRAMME_ID = re.compile(r"^(\d{3})-([A-Za-z0-9]+)-([12][SN])\d?-\d{2}$")
PROGRAMME_SUFFIX = re.compile(r",\s*(pierwszego|drugiego)\s+stopnia.*$")


@dataclass(frozen=True)
class Term:
    id: str
    name: str
    start: date
    end: date


@dataclass(frozen=True)
class Meeting:
    unit_id: int
    group_no: int
    day: date
    start: clock
    end: clock
    # classgroup2: potwierdzone spotkanie. classgroup: USOS wyliczył je
    # z częstotliwości i nie uwzględnia przeniesień dni.
    confirmed: bool


class UsosApi:
    RETRY_DELAYS = (2.0, 6.0)

    def __init__(
        self,
        base_url: str,
        *,
        limiter: RateLimiter,
        timeout: float,
        user_agent: str,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.base_url = base_url
        self.limiter = limiter
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers["User-Agent"] = user_agent
        self._sleep = sleep

    def call(self, method: str, **params: str | int):
        return self._send("get", method, params)

    def post(self, method: str, **params: str | int):
        """To samo co `call`, ale parametry idą w treści zapytania."""
        return self._send("post", method, params)

    def _send(self, verb: str, method: str, params: dict):
        attempts = len(self.RETRY_DELAYS) + 1
        for attempt in range(attempts):
            self.limiter.wait()
            try:
                if verb == "post":
                    response = self.session.post(self.base_url + method, data=params, timeout=self.timeout)
                else:
                    response = self.session.get(self.base_url + method, params=params, timeout=self.timeout)
            except requests.RequestException as exc:
                error: UsosError = UsosUnavailable(str(exc))
            else:
                if response.status_code < 400:
                    return response.json()
                if response.status_code < 500:
                    raise UsosError(f"HTTP {response.status_code}: {method}: {response.text[:200]}")
                # API odpowiada 500 także na zapytanie o edycję przedmiotu,
                # której nie ma, więc tego nie da się odróżnić od awarii.
                error = UsosUnavailable(f"HTTP {response.status_code}: {method}")
            if attempt < attempts - 1:
                self._sleep(self.RETRY_DELAYS[attempt])
        raise error

    def term(self, term_id: str) -> Term:
        data = self.call("terms/term", term_id=term_id)
        return Term(
            id=data["id"],
            name=data["name"]["pl"],
            start=date.fromisoformat(data["start_date"]),
            end=date.fromisoformat(data["end_date"]),
        )

    def search(self, method: str, query: str, fields: str | None = None) -> list[dict]:
        """Wszystkie strony wyników wyszukiwarki API (najwyżej SEARCH_LIMIT)."""
        found: list[dict] = []
        while len(found) < SEARCH_LIMIT:
            params = {"query": query, "lang": "pl", "num": 20, "start": len(found)}
            if fields:
                params["fields"] = fields
            page = self.call(method, **params)
            found += page["items"]
            if not page.get("next_page") or not page["items"]:
                break
        return found

    def faculties(self) -> list[tuple[str, str]]:
        """Wydziały AGH: kody NNN-000 i nazwy. Pomija biura i inne jednostki."""
        found = {}
        for item in self.search("fac/search", "Wydział", fields="id|name"):
            name = item["name"]["pl"]
            if item["id"].endswith("-000") and name.startswith("Wydział"):
                found[item["id"]] = name
        return sorted(found.items())

    def unit_name(self, unit: str) -> str:
        return self.call("fac/faculty", fac_id=unit, fields="id|name")["name"]["pl"]

    def programmes(self) -> dict[str, str]:
        """Nazwy kierunków studiów, np. {"100-IZP-1N": "Inżynieria i Zarządzanie…"}.

        Klucz to wydział, skrót kierunku wielkimi literami oraz stopień i tryb,
        bo tak kierunek zapisują też kody grup przedmiotów.
        """
        names = {}
        for query in PROGRAMME_QUERIES:
            for item in self.search("progs/search", query):
                match = PROGRAMME_ID.match(item["programme"]["id"])
                if not match:
                    continue
                faculty, code, level = match.groups()
                text = re.sub(r"</?b>", "", item["match"])
                names[f"{faculty}-{code.upper()}-{level}"] = PROGRAMME_SUFFIX.sub("", text).strip()
        return names

    def class_types(self) -> dict[str, str]:
        return {code: item["name"]["pl"] for code, item in self.call("courses/classtypes_index").items()}

    def meetings(self, groups: Iterable[tuple[int, int]], start: date, end: date) -> list[Meeting]:
        """Wszystkie spotkania grup zajęciowych od `start` do `end` włącznie."""
        ids = [f"{unit}|{group}" for unit, group in sorted(set(groups))]
        found = []
        day = start
        while day <= end:
            days = min(WINDOW_DAYS, (end - day).days + 1)
            for i in range(0, len(ids), BATCH):
                batch = self.post(
                    "tt/classgroups",
                    classgroup_ids="|".join(ids[i : i + BATCH]),
                    start=day.isoformat(),
                    days=days,
                    fields=MEETING_FIELDS,
                )
                found += [m for item in batch if (m := _meeting(item))]
            day += timedelta(days=days)
        return sorted(found, key=lambda m: (m.day, m.start, m.unit_id, m.group_no))


def _meeting(item: dict) -> Meeting | None:
    # Przy takich częstotliwościach API zwraca wszystkie możliwe dni cyklu,
    # a nie faktyczne spotkania.
    if item.get("frequency") in ("other", "once"):
        return None
    start = datetime.fromisoformat(item["start_time"])
    return Meeting(
        unit_id=item["unit_id"],
        group_no=item["group_number"],
        day=start.date(),
        start=start.time(),
        end=datetime.fromisoformat(item["end_time"]).time(),
        confirmed=item["type"] == "classgroup2",
    )
