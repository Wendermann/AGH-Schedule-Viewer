"""Stan widoku zapisany w samym linku „Udostępnij” i w adresie kalendarza.

Token to wersja (jeden znak) i skompresowany JSON w base64url, czyli tylko
znaki A–Z a–z 0–9 - _. Link tworzy przeglądarka (app/static/js/share.js,
ten sam format). Serwer odczytuje go tylko po to, żeby zbudować filtrowany
kalendarz; stanu nigdzie nie zapisujemy.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
import zlib
from dataclasses import dataclass, field
from datetime import date

from .plan.model import PlanKind, PlanRef
from .plan.selection import Selection

VERSION = "1"
MAX_TOKEN_LENGTH = 4000
MAX_JSON_BYTES = 32 * 1024
MAX_PLANS = 12

MODES = ("typical", "week")
PARITIES = ("all", "odd", "even")

_BODY = re.compile(r"^[A-Za-z0-9_-]*$")
_CODE = re.compile(r"^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż./_\- ]{1,64}$")


class InvalidShareToken(ValueError):
    pass


@dataclass(frozen=True)
class ViewState:
    plans: tuple[PlanRef, ...]
    selection: Selection = field(default_factory=Selection)
    mode: str = "typical"
    parity: str = "all"
    week: date | None = None


def encode(state: ViewState) -> str:
    payload = json.dumps(_to_json(state), ensure_ascii=False, separators=(",", ":"))
    packer = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = packer.compress(payload.encode()) + packer.flush()
    return VERSION + base64.urlsafe_b64encode(packed).rstrip(b"=").decode()


def decode(token: str) -> ViewState:
    if not token or len(token) > MAX_TOKEN_LENGTH:
        raise InvalidShareToken("nieprawidłowa długość")
    if token[0] != VERSION:
        raise InvalidShareToken(f"nieznana wersja {token[0]!r}")
    body = token[1:]
    if not _BODY.match(body):
        raise InvalidShareToken("niedozwolone znaki")
    try:
        packed = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        unpacker = zlib.decompressobj(-15)
        raw = unpacker.decompress(packed, MAX_JSON_BYTES)
        if unpacker.unconsumed_tail:
            raise InvalidShareToken("stan jest za duży")
        data = json.loads(raw)
    except (binascii.Error, zlib.error, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidShareToken("uszkodzony token") from exc
    try:
        return _from_json(data)
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidShareToken(str(exc)) from exc


def _to_json(state: ViewState) -> dict:
    data: dict = {"p": [_plan_to_json(ref) for ref in state.plans]}
    sel = state.selection
    if sel.hidden_subjects:
        data["hs"] = sorted(sel.hidden_subjects)
    if sel.hidden_types:
        data["ht"] = sorted([s, t] for s, t in sel.hidden_types)
    if sel.chosen_groups:
        data["mg"] = sorted([s, t, g] for (s, t), g in sel.chosen_groups.items())
    if state.mode != "typical":
        data["m"] = state.mode
    if state.parity != "all":
        data["par"] = state.parity
    if state.week is not None:
        data["w"] = state.week.isoformat()
    return data


def _plan_to_json(ref: PlanRef) -> list:
    item: list = [ref.kind.value, ref.code, ref.cycle]
    if ref.group_no is not None:
        item.append(ref.group_no)
    return item


def _from_json(data: dict) -> ViewState:
    if not isinstance(data, dict):
        raise TypeError("stan musi być obiektem")
    plans = tuple(_plan_from_json(item) for item in data["p"])
    if not plans or len(plans) > MAX_PLANS:
        raise ValueError(f"liczba planów musi być od 1 do {MAX_PLANS}")

    selection = Selection(
        hidden_subjects=frozenset(_code(s) for s in data.get("hs", [])),
        hidden_types=frozenset((_code(s), _code(t)) for s, t in data.get("ht", [])),
        chosen_groups={(_code(s), _code(t)): _group(g) for s, t, g in data.get("mg", [])},
    )
    mode = data.get("m", "typical")
    parity = data.get("par", "all")
    if mode not in MODES or parity not in PARITIES:
        raise ValueError("nieznany tryb widoku")
    week = date.fromisoformat(data["w"]) if "w" in data else None
    return ViewState(plans, selection, mode, parity, week)


def _plan_from_json(item: list) -> PlanRef:
    kind = PlanKind(item[0])
    code = _code(item[1])
    cycle = _code(item[2]) if item[2] else ""
    group_no = _group(item[3]) if len(item) > 3 else None
    return PlanRef(kind, code, cycle, group_no)


def _code(value: object) -> str:
    if not isinstance(value, str) or not _CODE.match(value):
        raise ValueError(f"nieprawidłowy kod: {value!r}")
    return value


def _group(value: object) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value < 10_000:
        raise ValueError(f"nieprawidłowy numer grupy: {value!r}")
    return value
