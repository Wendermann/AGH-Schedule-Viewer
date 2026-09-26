"""Odmiana polskich rzeczowników przy liczebnikach w komunikatach poleceń."""


def plural(n: int, one: str, few: str, many: str) -> str:
    """plural(1, "plan", "plany", "planów") -> "plan"; 3 -> "plany"; 5 -> "planów"."""
    if n == 1:
        return one
    return few if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else many
