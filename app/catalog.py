"""Położenie grupy przedmiotów w drzewie: kierunek, stopień, semestr, wariant.

Wydziały zapisują kody grup po swojemu, np. `240-ZBI-1S-2R-Z`,
`IGR_2N_s1`, `ELT_1N_sem_8_AiM`, `GIK-1S,sem.5`, `CHB-1S,1sem,PP`,
`MBM-2S_s1L,POSangETM`. Wspólne są skrót kierunku, stopień z trybem
(1S, 2S, 1N, 2N) i numer semestru w jednej z kilku postaci. Grupa, z której
nie da się odczytać kierunku albo semestru, trafia w drzewie do „Inne”.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Prefiks jednostki, np. „130_”, „230-”, „110-000_”.
UNIT_PREFIX = re.compile(r"^\d{3}(?:-000)?[-_]")
SEPARATORS = re.compile(r"[-_,.()\s]+")
LEVEL = re.compile(r"^[12][SN]$", re.I)
PROGRAMME = re.compile(r"^[A-Za-z]{2,5}$")
SEMESTER_FORMS = (
    re.compile(r"^(?:s|sem)(\d{1,2})[LZ]?$", re.I),  # s1, sem5, s1L
    re.compile(r"^(\d{1,2})(?:s|sem|semestr)$", re.I),  # 8sem, 1s, 1semestr
)
SEMESTER_WORD = re.compile(r"^(?:s|sem|semestr)$", re.I)
YEAR = re.compile(r"^([0-6])R$", re.I)
SEASON = {"Z": 1, "L": 2}
SEMESTER_IN_NAME = re.compile(r"semestr\s*(\d{1,2})|(\d{1,2})\s*sem(?:estr)?\b|sem\.\s*(\d{1,2})", re.I)
# Dopiski bez znaczenia dla wyboru grupy.
NOISE = {"ALL", "KANON"}


@dataclass(frozen=True)
class GroupPlace:
    programme: str | None
    level: str | None
    semester: int | None
    variant: str | None


def place(code: str, name: str) -> GroupPlace:
    tokens = [t for t in SEPARATORS.split(UNIT_PREFIX.sub("", code)) if t]
    level = programme = semester = None
    used: set[int] = set()

    for i, token in enumerate(tokens):
        if level is None and LEVEL.match(token):
            level = token.upper()
            used.add(i)
    for i, token in enumerate(tokens):
        # „1S” to stopień, choć wygląda jak „1s” (semestr 1).
        if i in used:
            continue
        following = tokens[i + 1] if i + 1 < len(tokens) else ""
        if match := next((m for form in SEMESTER_FORMS if (m := form.match(token))), None):
            semester = int(match.group(1))
            used.add(i)
        elif SEMESTER_WORD.match(token) and following.isdigit():
            semester = int(following)
            used.update((i, i + 1))
        elif token.isdigit() and (SEMESTER_WORD.match(following) or (i - 1 in used and LEVEL.match(tokens[i - 1]))):
            # „2 sem” albo sama liczba zaraz po stopniu, np. RMV_2S_3.
            semester = int(token)
            used.update((i, i + 1) if following and SEMESTER_WORD.match(following) else (i,))
        elif (year := YEAR.match(token)) and following.upper() in SEASON:
            # 240-ZBI-1S-2R-Z: rok studiów i semestr zimowy albo letni.
            # Rok 0 to semestr wyrównawczy przed studiami II stopnia.
            number = int(year.group(1))
            semester = (number - 1) * 2 + SEASON[following.upper()] if number else 0
            used.update((i, i + 1))
        if semester is not None:
            break
    if semester is None and (match := SEMESTER_IN_NAME.search(name)):
        semester = int(next(g for g in match.groups() if g))

    for i, token in enumerate(tokens):
        if i not in used and PROGRAMME.match(token) and not SEMESTER_WORD.match(token):
            programme = token.upper()
            used.add(i)
            break

    rest = [t for i, t in enumerate(tokens) if i not in used and t.upper() not in NOISE]
    return GroupPlace(programme, level, semester, " ".join(rest) or None)
