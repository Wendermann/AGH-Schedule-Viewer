import base64
import json
import re
import zlib
from datetime import date

import pytest

from app.plan.model import PlanKind, PlanRef
from app.plan.selection import Selection
from app.share import InvalidShareToken, ViewState, decode, encode

GROUP = PlanRef(PlanKind.SUBJECT_GROUP, "240-ZBI-1S-2R-Z", "26/27-Z")

# Wygenerowany w przeglądarce przez app/static/js/share.js z tego samego
# stanu co full_state().
BROWSER_TOKEN = (
    "1VYy7CsJAFAX_Zep7cffmIWxnOtFKi-AuKYSECCIGFQKK_y6JINjOnDkvBkJK9AiWO43VWv1ebadxIuXClhppJPFE8JblRYmAZE0jnO6ERB2_mfNM7DEf_qAh1IcN0_7S_7sMYbuqkHy2BMauOyMMxxuBa9sijATMWaneqSt4fwA"
)


def full_state():
    return ViewState(
        plans=(GROUP, PlanRef(PlanKind.CLASS_GROUP, "123456", "", 3)),
        selection=Selection(
            hidden_subjects=frozenset({"WZ-ZBI-101"}),
            hidden_types=frozenset({("WZ-ZBI-102", "WYK")}),
            chosen_groups={("WZ-ZBI-103", "LAB"): 4},
        ),
        mode="week",
        parity="odd",
        week=date(2026, 10, 5),
    )


def test_round_trip_keeps_everything():
    state = full_state()
    assert decode(encode(state)) == state


def test_token_produced_in_the_browser_decodes_to_the_same_state():
    assert decode(BROWSER_TOKEN) == full_state()


def test_minimal_state_round_trips():
    state = ViewState(plans=(GROUP,))
    assert decode(encode(state)) == state


def test_token_uses_only_url_safe_characters():
    assert re.fullmatch(r"[A-Za-z0-9_-]+", encode(full_state()))


def test_token_is_short_enough_for_a_link():
    assert len(encode(full_state())) < 200


@pytest.mark.parametrize("token", ["", "9abc", "1!!!", "1" + "A" * 5000, "1AAAA"])
def test_garbage_is_rejected(token):
    with pytest.raises(InvalidShareToken):
        decode(token)


def pack(data) -> str:
    packer = zlib.compressobj(9, zlib.DEFLATED, -15)
    raw = data if isinstance(data, bytes) else json.dumps(data).encode()
    packed = packer.compress(raw) + packer.flush()
    return "1" + base64.urlsafe_b64encode(packed).rstrip(b"=").decode()


@pytest.mark.parametrize(
    "data",
    [
        [],
        {"p": []},
        {"p": [["x", "A", ""]]},
        {"p": [["g", "<script>", ""]]},
        {"p": [["g", "A", ""]], "m": "month"},
        {"p": [["g", "A", ""]], "mg": [["A", "LAB", True]]},
        {"p": [["g", "A", ""]] * 13},
    ],
)
def test_invalid_contents_are_rejected(data):
    with pytest.raises(InvalidShareToken):
        decode(pack(data))


def test_decompression_bomb_is_rejected():
    with pytest.raises(InvalidShareToken):
        decode(pack(b"[" + b" " * 1_000_000 + b"]"))
