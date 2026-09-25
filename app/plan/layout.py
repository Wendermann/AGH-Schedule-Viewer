"""Rozmieszczenie nakładających się bloczków obok siebie w kolumnie dnia."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import time

from .model import Activity


@dataclass(frozen=True)
class Placed:
    activity: Activity
    lane: int
    lanes: int


def place_day(activities: Iterable[Activity]) -> list[Placed]:
    """Przydziela tory tak, by nakładające się w czasie zajęcia stały obok siebie.

    Szerokość bloczka zależy tylko od jego grupy nakładających się zajęć,
    więc samotne zajęcia zajmują całą kolumnę, nawet gdy w tym samym dniu
    jest gdzie indziej tłok.
    """
    placed: list[Placed] = []
    cluster: list[tuple[Activity, int]] = []
    lane_ends: list[time] = []
    cluster_end = time.min

    def close_cluster() -> None:
        lanes = len(lane_ends)
        placed.extend(Placed(a, lane, lanes) for a, lane in cluster)

    for activity in sorted(activities, key=_longest_first):
        if cluster and activity.start >= cluster_end:
            close_cluster()
            cluster, lane_ends = [], []
        for lane, end in enumerate(lane_ends):
            if end <= activity.start:
                lane_ends[lane] = activity.end
                break
        else:
            lane = len(lane_ends)
            lane_ends.append(activity.end)
        cluster.append((activity, lane))
        cluster_end = max(cluster_end, activity.end) if len(cluster) > 1 else activity.end

    if cluster:
        close_cluster()
    return placed


def _longest_first(activity: Activity) -> tuple[time, int]:
    # Przy równym starcie dłuższe zajęcia trafiają na lewy tor.
    return activity.start, -(activity.end.hour * 60 + activity.end.minute)
