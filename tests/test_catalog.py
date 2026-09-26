import json
from pathlib import Path

import pytest

from app.catalog import GroupPlace, place

# Kody i nazwy wszystkich grup przedmiotów AGH z USOSweb, 26.09.2026.
GROUPS = json.loads((Path(__file__).parent / "fixtures" / "usos" / "groups-agh-2026-09-26.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    "code, name, expected",
    [
        ("240-ZBI-1S-2R-Z", "240 - Informatyka - Zarządzanie bezpieczeństwem informacji, semestr 3", ("ZBI", "1S", 3, None)),
        ("240-TPW-1S-1R-L", "240-Tworzenie Przestrzeni Wirtualnych i Gier, semestr 2", ("TPW", "1S", 2, None)),
        ("240-IDS-2S-0R-Z", "240_Informatyka-Data Science, II st., 0 semestr", ("IDS", "2S", 0, None)),
        ("240_INF-1S,7sem,po", "240_INF,stacjonarne, 1S,przedmioty obieralne", ("INF", "1S", 7, "po")),
        ("IGR_2N_s1", "IGR_2N_s1", ("IGR", "2N", 1, None)),
        ("ETI_1S_sem5", "ETI_1S_sem5", ("ETI", "1S", 5, None)),
        ("ELT_1N_sem_8_AiM", "ELT_1N_ssem_8_AiM", ("ELT", "1N", 8, "AiM")),
        ("130_MBM_1S_sem4", "130_MBM_1S_sem4", ("MBM", "1S", 4, None)),
        ("MBM-2S_s1L,POSangETM", "WIMiR_MBM-ETM, stacjonarne, 2S, 1sem.L", ("MBM", "2S", 1, "POSangETM")),
        ("GFI_AG_2S_s1_ALL", "GFI_AG_2S_s1_ALL", ("GFI", "2S", 1, "AG")),
        ("GIK-1S,sem.5", "150-GIK-1S-semestr 5", ("GIK", "1S", 5, None)),
        ("GiK-1N,8sem(22/23)", "GiK, stud.niestac. (od 2019/20) sem. 8", ("GIK", "1N", 8, "22/23")),
        ("CHB-1S,1sem,PP", "CHB, stacjonarne I stopnia, 1 semestr, przedmioty podstawowe", ("CHB", "1S", 1, "PP")),
        ("IMN_2S_s3_INM_kanon", "IMN, stacjonarne II stopnia , semestr 3", ("IMN", "2S", 3, "INM")),
        ("ZRZ-1N,1semestr,PP", "ZARZ, niestacjonarne I stopnia, przedmioty podstawowe", ("ZRZ", "1N", 1, "PP")),
        ("ZIP-2N, 2 sem ZJ PP", "Zarządzanie i inżynieria produkcji", ("ZIP", "2N", 2, "ZJ PP")),
        ("RMV_2S_3", "RMV_2S_3", ("RMV", "2S", 3, None)),
        ("230-EiT_1N_sem1", "EiT_1N_sem1", ("EIT", "1N", 1, None)),
        ("420-MAT-MOiK-s3-PO", "MOiK- przedmioty obieralne, semestr 3", ("MAT", None, 3, "MOiK PO")),
        ("ENR_COIK_s1_all", "ENR, COIK, stacjonarne II stopnia, semestr 1, all", ("ENR", None, 1, "COIK")),
    ],
)
def test_place(code, name, expected):
    assert place(code, name) == GroupPlace(*expected)


def test_level_is_not_read_as_semester():
    # „1S” wygląda jak „1s” (semestr 1), ale tu to stopień.
    assert place("NTK_1S_sem3", "NTK_1S_sem3").semester == 3
    assert place("420-1S-s2", "Matematyka semestr 2, kanon") == GroupPlace(None, "1S", 2, None)


def test_groups_without_programme_or_semester_go_to_other():
    assert place("000-HES-1S", "Grupa przedmiotów HES dla I stopnia").semester is None
    assert place("110-000_pościg", "WIMIP_grupy pościgowe").programme is None


def test_almost_all_agh_groups_are_placed():
    places = [place(code, name) for groups in GROUPS.values() for code, name in groups]
    placed = [p for p in places if p.programme and p.semester is not None]
    assert len(places) == 1199
    assert len(placed) >= 1170
