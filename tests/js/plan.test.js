import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applySelection,
  clashWeeks,
  collide,
  conflicts,
  conflictsPerDay,
  emptySelection,
  mergePlans,
  placeDay,
  typeKey,
} from "../../app/static/js/plan.js";

function activity(overrides = {}) {
  return {
    subject: "FIZ",
    subjectName: "Fizyka",
    type: "LAB",
    group: 1,
    weekday: 0,
    start: "08:00",
    end: "09:30",
    recurrence: "weekly",
    dates: [],
    lecturers: [],
    room: null,
    ...overrides,
  };
}

const ids = (list) => list.map((a) => `${a.subject} ${a.type} ${a.group}`);

test("hidden subject hides all its classes", () => {
  const sel = emptySelection();
  sel.hiddenSubjects.add("FIZ");
  const visible = applySelection(
    [activity({ type: "WYK" }), activity({ group: 3 }), activity({ subject: "MAT" })],
    sel,
  );
  assert.deepEqual(ids(visible), ["MAT LAB 1"]);
});

test("hidden type keeps other types of the subject", () => {
  const sel = emptySelection();
  sel.hiddenTypes.add(typeKey("FIZ", "WYK"));
  const visible = applySelection([activity({ type: "WYK" }), activity()], sel);
  assert.deepEqual(ids(visible), ["FIZ LAB 1"]);
});

test("chosen group hides only other groups of that type", () => {
  const sel = emptySelection();
  sel.chosenGroups.set(typeKey("FIZ", "LAB"), 3);
  const visible = applySelection(
    [
      activity({ group: 1 }),
      activity({ group: 3 }),
      activity({ type: "CW", group: 1 }),
      activity({ subject: "MAT", group: 1 }),
    ],
    sel,
  );
  assert.deepEqual(ids(visible), ["FIZ LAB 3", "FIZ CW 1", "MAT LAB 1"]);
});

test("shared lecture appears once with both sources", () => {
  const lecture = activity({ type: "WYK" });
  const merged = mergePlans([
    { key: "g:A", activities: [lecture] },
    { key: "g:B", activities: [lecture, activity({ subject: "MAT", subjectName: "Matematyka" })] },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.find((a) => a.subject === "FIZ").sources, ["g:A", "g:B"]);
  assert.equal(lecture.sources, undefined, "merge must not modify input");
});

test("merge orders chronologically", () => {
  const merged = mergePlans([
    {
      key: "g:A",
      activities: [
        activity({ subject: "B", weekday: 1 }),
        activity({ subject: "A", start: "12:00", end: "13:30" }),
      ],
    },
  ]);
  assert.deepEqual(merged.map((a) => a.subject), ["A", "B"]);
});

test("touching classes do not collide", () => {
  assert.equal(collide(activity(), activity({ start: "09:30", end: "11:00" })), false);
});

test("odd and even weeks do not collide", () => {
  const odd = activity({ recurrence: "odd" });
  assert.equal(collide(odd, activity({ recurrence: "even" })), false);
  assert.equal(collide(odd, activity()), true);
});

test("groups of the same class type are alternatives, not conflicts", () => {
  assert.equal(collide(activity({ group: 1 }), activity({ group: 2 })), false);
  assert.equal(collide(activity({ group: 1 }), activity({ type: "W", group: 2 })), true);
  assert.equal(collide(activity({ group: 1 }), activity({ subject: "MAT", group: 2 })), true);
});

test("concrete dates decide when both are known", () => {
  const on = (date) => activity({ recurrence: "irregular", dates: [date] });
  assert.equal(collide(on("2026-10-05"), on("2026-10-12")), false);
  assert.equal(collide(on("2026-10-12"), on("2026-10-12")), true);
});

test("clash weeks follow parity of both classes", () => {
  const parity = () => null;
  assert.equal(clashWeeks(activity({ recurrence: "odd" }), activity({ subject: "B", recurrence: "odd" }), parity), "odd");
  assert.equal(clashWeeks(activity(), activity({ subject: "B", recurrence: "even" }), parity), "even");
  assert.equal(clashWeeks(activity(), activity({ subject: "B" }), parity), "both");
  assert.equal(clashWeeks(activity({ recurrence: "odd" }), activity({ subject: "B", recurrence: "even" }), parity), null);
});

test("clash weeks come from shared dates when both are known", () => {
  // Tydzień 1 semestru zaczyna się 1.10, więc 5.10 jest nieparzysty, a 12.10 parzysty.
  const parity = (date) => (date < "2026-10-08" ? "odd" : "even");
  const weekly = activity({ dates: ["2026-10-05", "2026-10-12"] });
  const oddOnly = activity({ subject: "B", recurrence: "odd", dates: ["2026-10-05"] });
  assert.equal(clashWeeks(weekly, oddOnly, parity), "odd");
  assert.equal(clashWeeks(weekly, activity({ subject: "B", dates: ["2026-10-05", "2026-10-12"] }), parity), "both");
});

test("conflicts are counted per day", () => {
  const acts = [
    activity({ subject: "A", weekday: 2, start: "10:00", end: "11:30" }),
    activity({ subject: "B", weekday: 2, start: "11:00", end: "12:30" }),
    activity({ subject: "C", weekday: 2, start: "12:00", end: "13:00" }),
    activity({ subject: "D", weekday: 3 }),
  ];
  assert.equal(conflicts(acts).length, 2);
  assert.deepEqual([...conflictsPerDay(acts)], [[2, 2]]);
});

const lanes = (placed) =>
  Object.fromEntries(placed.map((p) => [p.activity.subject, [p.lane, p.lanes]]));

test("single class takes full width", () => {
  assert.deepEqual(lanes(placeDay([activity({ subject: "A" })])), { A: [0, 1] });
});

test("overlapping classes sit side by side", () => {
  const placed = placeDay([
    activity({ subject: "A" }),
    activity({ subject: "B" }),
    activity({ subject: "C", start: "09:00", end: "10:30" }),
  ]);
  assert.deepEqual(lanes(placed), { A: [0, 3], B: [1, 3], C: [2, 3] });
});

test("longer class goes left and freed lane is reused", () => {
  const placed = placeDay([
    activity({ subject: "B" }),
    activity({ subject: "A", end: "11:00" }),
    activity({ subject: "C", start: "09:30", end: "10:30" }),
  ]);
  assert.deepEqual(lanes(placed), { A: [0, 2], B: [1, 2], C: [1, 2] });
});

test("separate clusters have independent widths", () => {
  const placed = placeDay([
    activity({ subject: "A" }),
    activity({ subject: "B" }),
    activity({ subject: "C", start: "12:00", end: "13:30" }),
  ]);
  assert.deepEqual(lanes(placed).C, [0, 1]);
});
