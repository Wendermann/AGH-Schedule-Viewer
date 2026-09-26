import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { createApp, groupTree, planHref, searchGroups, statusMessage } from "../../app/static/js/model.js";
import { encodeState } from "../../app/static/js/share.js";

// Model zapisuje stan w adresie i w pamięci przeglądarki; w Node podstawiamy
// najprostsze odpowiedniki.
let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.history = { replaceState: (_state, _title, url) => (globalThis.location = urlOf(url)) };
  globalThis.location = urlOf("/plan.html");
});

function urlOf(path) {
  const url = new URL(path, "https://example.test");
  return { origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash };
}

function activity(overrides = {}) {
  return {
    subject: "240-ZBI-1S-114",
    subjectName: "Fizyka 2",
    type: "W",
    group: 1,
    unit: 191059,
    weekday: 0,
    start: "08:00",
    end: "09:30",
    recurrence: "weekly",
    lecturers: [],
    room: null,
    building: null,
    block: false,
    dates: ["2026-10-05"],
    moved: [],
    ...overrides,
  };
}

const PLANS = {
  "240-ZBI-1S-2R-Z": { code: "240-ZBI-1S-2R-Z", name: "ZBI, semestr 3", cycle: "26/27-Z", stale: false, activities: [activity()] },
  "240-ZBI-1S-1R-Z": { code: "240-ZBI-1S-1R-Z", name: "ZBI, semestr 1", cycle: "26/27-Z", stale: true, activities: [activity({ subject: "MAT", group: 2 })] },
  "240-INF-1S-1R-L": { code: "240-INF-1S-1R-L", name: "INF, semestr 2", cycle: "26/27-Z", stale: false, activities: [] },
};

const plansOf = (code) => (code in PLANS ? [{ cycle: "26/27-Z", history: false }] : []);

function siteData() {
  return {
    term: { id: "26/27-Z", name: "Semestr zimowy 2026/2027", start: "2026-10-01", end: "2027-02-28" },
    classTypes: { W: "wykład" },
    faculties: [{ code: "240-000", name: "Wydział Informatyki" }],
    groups: [
      ...Object.values(PLANS).map((p) => ({ code: p.code, name: p.name, faculty: "240-000", plans: plansOf(p.code) })),
      { code: "240-ZBI-1S-2R-L", name: "ZBI, semestr 4", faculty: "240-000", plans: [] },
      { code: "240_INF-1S,7sem,po", name: "przedmioty obieralne", faculty: "240-000", plans: [] },
    ],
    plans: [],
  };
}

function makeApp() {
  const loaded = [];
  const app = createApp(siteData(), {
    storageKey: "stan",
    loadPlan: async (code, cycle) => {
      loaded.push(`${code}@${cycle}`);
      return structuredClone(PLANS[code]);
    },
  });
  return { app, loaded };
}

test("plan is loaded on first use and then kept", async () => {
  const { app, loaded } = makeApp();
  await app.openPlan("240-ZBI-1S-2R-Z");
  await app.openPlan("240-ZBI-1S-2R-Z");
  assert.deepEqual(loaded, ["240-ZBI-1S-2R-Z@26/27-Z"]);
  assert.deepEqual(app.activePlans().map((p) => p.code), ["240-ZBI-1S-2R-Z"]);
});

test("group without classes in the cycle cannot be opened", async () => {
  const { app } = makeApp();
  await assert.rejects(app.openPlan("240-ZBI-1S-2R-L"), /nie ma w danych strony/);
});

test("data status comes from the plan files", async () => {
  const { app } = makeApp();
  await app.openPlan("240-ZBI-1S-2R-Z");
  assert.equal(app.status().kind, "ok");
  await app.addPlan("240-ZBI-1S-1R-Z");
  assert.equal(app.status().kind, "cache");
  await app.openPlan("240-INF-1S-1R-L");
  assert.equal(app.status().kind, "empty");
  assert.match(statusMessage("empty", app.activePlans()[0]), /nie ma żadnych zajęć/);
});

test("calendar falls back to the term dates when the cycle has none", () => {
  const { app } = makeApp();
  assert.equal(app.data.calendar.firstClass, "2026-10-01");
  assert.deepEqual(app.data.calendar.swaps, {});
});

test("tree marks groups without classes and keeps odd codes apart", () => {
  const [faculty] = groupTree(siteData());
  const zbi = faculty.programmes.find((p) => p.code === "ZBI");
  const year2 = zbi.years.find((y) => y.year === 2);
  assert.deepEqual(year2.semesters.map((s) => [s.semester, s.available]), [[3, true], [4, false]]);
  assert.deepEqual(faculty.other.map((g) => g.code), ["240_INF-1S,7sem,po"]);
});

test("search reports availability", () => {
  const found = searchGroups(siteData(), "zbi semestr");
  assert.deepEqual(found.map((g) => [g.code, g.available]), [
    ["240-ZBI-1S-2R-Z", true],
    ["240-ZBI-1S-1R-Z", true],
    ["240-ZBI-1S-2R-L", false],
  ]);
});

test("link from the start page opens the plan", async () => {
  globalThis.location = urlOf(planHref("/AGH-Schedule-Viewer/", "240-ZBI-1S-2R-Z", "26/27-Z"));
  assert.equal(location.search, "?plan=240-ZBI-1S-2R-Z&cykl=26%2F27-Z");
  const { app } = makeApp();
  assert.equal(await app.restore(), null);
  assert.deepEqual(app.activePlans().map((p) => p.code), ["240-ZBI-1S-2R-Z"]);
});

test("shared link restores plans and skips the ones no longer published", async () => {
  const { app } = makeApp();
  await app.openPlan("240-ZBI-1S-2R-Z");
  await app.addPlan("240-ZBI-1S-1R-Z");
  app.toggleSubject("MAT");
  assert.match(await app.shareUrl(), /^https:\/\/example\.test\/plan\.html#.+/);
  const state = { ...app.state, plans: [...app.state.plans, { kind: "g", code: "240-XXX-1S-1R-Z", cycle: "26/27-Z" }] };
  globalThis.location = urlOf(`/plan.html#${await encodeState(state)}`);

  const other = makeApp().app;
  const problem = await other.restore();
  assert.match(problem, /240-XXX-1S-1R-Z/);
  assert.deepEqual(other.activePlans().map((p) => p.code), ["240-ZBI-1S-2R-Z", "240-ZBI-1S-1R-Z"]);
  assert.equal(other.hiddenCount(), 1);
});

test("broken token is reported, not thrown", async () => {
  globalThis.location = urlOf("/plan.html#zepsuty");
  const { app } = makeApp();
  assert.match(await app.restore(), /uszkodzony/);
  assert.equal(app.state.plans.length, 0);
});

test("state is saved to the address and to storage after a change", async () => {
  const { app } = makeApp();
  await app.openPlan("240-ZBI-1S-2R-Z");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(location.hash.length > 1);
  assert.equal(storage.get("stan"), location.hash.slice(1));
});
