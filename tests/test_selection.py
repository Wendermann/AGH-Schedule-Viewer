from app.plan.selection import Selection


def test_empty_selection_shows_everything(activity):
    assert Selection().shows(activity())
    assert Selection().is_empty


def test_hidden_subject_hides_all_its_classes(activity):
    sel = Selection(hidden_subjects=frozenset({"FIZ"}))
    assert not sel.shows(activity(kind="WYK"))
    assert not sel.shows(activity(kind="LAB", group=3))
    assert sel.shows(activity(subject="MAT"))


def test_hidden_type_keeps_other_types_of_the_subject(activity):
    sel = Selection(hidden_types=frozenset({("FIZ", "WYK")}))
    assert not sel.shows(activity(kind="WYK"))
    assert sel.shows(activity(kind="LAB"))
    assert sel.shows(activity(subject="MAT", kind="WYK"))


def test_chosen_group_hides_only_other_groups_of_that_type(activity):
    sel = Selection(chosen_groups={("FIZ", "LAB"): 3})
    visible = sel.apply(
        [
            activity(kind="LAB", group=1),
            activity(kind="LAB", group=3),
            activity(kind="CW", group=1),
            activity(subject="MAT", kind="LAB", group=1),
        ]
    )
    assert [(a.subject_code, a.class_type, a.group_no) for a in visible] == [
        ("FIZ", "LAB", 3),
        ("FIZ", "CW", 1),
        ("MAT", "LAB", 1),
    ]
