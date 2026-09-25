// Ukrywanie, łączenie planów, kolizje i układ bloczków w kolumnie dnia.
//
// Zajęcia (activity) mają postać jak w danych JSON:
//   { subject, subjectName, type, group, weekday, start: "08:00", end: "09:30",
//     recurrence: "weekly" | "odd" | "even" | "irregular", dates: ["2026-10-05"],
//     lecturers: [], room, sources: [] }
// Godziny są zapisane jako "HH:MM", więc porównanie napisów porównuje czas.

export function typeKey(subject, type) {
  return `${subject}|${type}`;
}

export function emptySelection() {
  return { hiddenSubjects: new Set(), hiddenTypes: new Set(), chosenGroups: new Map() };
}

export function isVisible(activity, selection) {
  if (selection.hiddenSubjects.has(activity.subject)) return false;
  const key = typeKey(activity.subject, activity.type);
  if (selection.hiddenTypes.has(key)) return false;
  const chosen = selection.chosenGroups.get(key);
  return chosen === undefined || chosen === activity.group;
}

export function applySelection(activities, selection) {
  return activities.filter((a) => isVisible(a, selection));
}

function identity(a) {
  // Wspólny wykład występuje w planach kilku kierunków; po połączeniu
  // ma zostać jeden bloczek z kilkoma źródłami.
  return [a.subject, a.type, a.group, a.weekday, a.start, a.end].join("\u0000");
}

function chronological(a, b) {
  return (
    a.weekday - b.weekday ||
    compare(a.start, b.start) ||
    compare(a.end, b.end) ||
    compare(a.subjectName, b.subjectName) ||
    compare(a.type, b.type) ||
    a.group - b.group
  );
}

function compare(x, y) {
  return x < y ? -1 : x > y ? 1 : 0;
}

// plans: [{ key, activities }]
export function mergePlans(plans) {
  const merged = new Map();
  for (const plan of plans) {
    for (const activity of plan.activities) {
      const id = identity(activity);
      const existing = merged.get(id);
      if (!existing) {
        merged.set(id, { ...activity, sources: [plan.key] });
      } else if (!existing.sources.includes(plan.key)) {
        existing.sources.push(plan.key);
      }
    }
  }
  return [...merged.values()].sort(chronological);
}

export function overlapsInTime(a, b) {
  return a.weekday === b.weekday && a.start < b.end && b.start < a.end;
}

// Czy da się fizycznie trafić na oba zajęcia naraz.
export function collide(a, b) {
  if (!overlapsInTime(a, b)) return false;
  if (a.dates?.length && b.dates?.length) {
    const dates = new Set(a.dates);
    return b.dates.some((d) => dates.has(d));
  }
  const pair = new Set([a.recurrence, b.recurrence]);
  return !(pair.size === 2 && pair.has("odd") && pair.has("even"));
}

export function conflicts(activities) {
  const ordered = [...activities].sort(chronological);
  const found = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length && ordered[j].weekday === ordered[i].weekday; j++) {
      if (collide(ordered[i], ordered[j])) found.push([ordered[i], ordered[j]]);
    }
  }
  return found;
}

export function conflictsPerDay(activities) {
  const counts = new Map();
  for (const [a] of conflicts(activities)) {
    counts.set(a.weekday, (counts.get(a.weekday) ?? 0) + 1);
  }
  return counts;
}

// Przydziela tory tak, by nakładające się w czasie zajęcia stały obok siebie.
// Szerokość bloczka zależy tylko od jego grupy nakładających się zajęć, więc
// samotne zajęcia zajmują całą kolumnę, nawet gdy w tym samym dniu jest
// gdzie indziej tłok. Przy równym starcie dłuższe zajęcia idą na lewy tor.
export function placeDay(activities) {
  const ordered = [...activities].sort(
    (a, b) => compare(a.start, b.start) || compare(b.end, a.end),
  );
  const placed = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = "";

  const closeCluster = () => {
    for (const item of cluster) placed.push({ ...item, lanes: laneEnds.length });
  };

  for (const activity of ordered) {
    if (cluster.length && activity.start >= clusterEnd) {
      closeCluster();
      cluster = [];
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((end) => end <= activity.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(activity.end);
    } else {
      laneEnds[lane] = activity.end;
    }
    cluster.push({ activity, lane });
    clusterEnd = cluster.length > 1 && clusterEnd > activity.end ? clusterEnd : activity.end;
  }
  if (cluster.length) closeCluster();
  return placed;
}
