from app.plan.layout import place_day


def lanes(placed):
    return {p.activity.subject_code: (p.lane, p.lanes) for p in placed}


def test_single_class_takes_full_width(activity):
    assert lanes(place_day([activity(subject="A")])) == {"A": (0, 1)}


def test_overlapping_classes_sit_side_by_side(activity):
    placed = place_day(
        [
            activity(subject="A", start="8:00", end="9:30"),
            activity(subject="B", start="8:00", end="9:30"),
            activity(subject="C", start="9:00", end="10:30"),
        ]
    )
    assert lanes(placed) == {"A": (0, 3), "B": (1, 3), "C": (2, 3)}


def test_freed_lane_is_reused_within_cluster(activity):
    placed = place_day(
        [
            activity(subject="A", start="8:00", end="11:00"),
            activity(subject="B", start="8:00", end="9:30"),
            activity(subject="C", start="9:30", end="10:30"),
        ]
    )
    assert lanes(placed) == {"A": (0, 2), "B": (1, 2), "C": (1, 2)}


def test_separate_clusters_have_independent_widths(activity):
    placed = place_day(
        [
            activity(subject="A", start="8:00", end="9:30"),
            activity(subject="B", start="8:00", end="9:30"),
            activity(subject="C", start="12:00", end="13:30"),
        ]
    )
    assert lanes(placed)["C"] == (0, 1)
