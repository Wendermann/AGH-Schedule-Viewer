import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { createApp, groupTitle, groupTree, planHref, searchGroups, statusMessage, treePath } from "../../app/static/js/model.js";
import { encodeState } from "../../app/static/js/share.js";

// Model zapisuje stan w adresie; w Node podstawiamy najprostsze odpowiedniki.
beforeEach(() => {
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
  "IGR_2N_s1": { code: "IGR_2N_s1", name: "IGR_2N_s1", cycle: "26/27-Z", stale: false, activities: [activity({ subject: "IGR" })] },
  "240_INF-1S,7sem,po": { code: "240_INF-1S,7sem,po", name: "przedmioty obieralne", cycle: "26/27-Z", stale: false, activities: [activity({ subject: "OBI" })] },
  "000-HES-1S": { code: "000-HES-1S", name: "Grupa przedmiotów HES", cycle: "26/27-Z", stale: false, activities: [activity({ subject: "HES" })] },
};

const plansOf = (code) => (code in PLANS ? [{ cycle: "26/27-Z", history: false }] : []);
// Pola kierunku, stopnia i semestru dopisuje flask fetch (app/catalog.py).
const group = (code, name, faculty, where = {}) => ({ code, name, faculty, plans: plansOf(code), ...where });

function siteData() {
  return {
    term: { id: "26/27-Z", name: "Semestr zimowy 2026/2027", start: "2026-10-01", end: "2027-02-28" },
    classTypes: { W: "wykład" },
    faculties: [
      { code: "100-000", name: "Wydział Inżynierii Lądowej i Gospodarki Zasobami" },
      { code: "170-000", name: "Wydział Odlewnictwa" },
      { code: "240-000", name: "Wydział Informatyki" },
      { code: "000-000", name: "Grupy ogólnouczelniane" },
    ],
    groups: [
      group("240-ZBI-1S-2R-Z", "ZBI, semestr 3", "240-000", { programme: "ZBI", level: "1S", semester: 3 }),
      group("240-ZBI-1S-1R-Z", "ZBI, semestr 1", "240-000", { programme: "ZBI", level: "1S", semester: 1 }),
      group("240-INF-1S-1R-L", "INF, semestr 2", "240-000", { programme: "INF", level: "1S", semester: 2 }),
      group("240-ZBI-1S-2R-L", "ZBI, semestr 4", "240-000", { programme: "ZBI", level: "1S", semester: 4 }),
      group("240_INF-1S,7sem,po", "przedmioty obieralne", "240-000", { programme: "INF", level: "1S", semester: 7, variant: "po" }),
      group("IGR_2N_s1", "IGR_2N_s1", "100-000", { programme: "IGR", level: "2N", semester: 1 }),
      group("000-HES-1S", "Grupa przedmiotów HES", "000-000", { programme: "HES", level: "1S" }),
    ],
    programmes: {
      "240-ZBI-1S": "Informatyka - Zarządzanie Bezpieczeństwem Informacji",
      "240-INF-1S": "Informatyka",
      "100-IGR-2N": "Inżynieria Górnicza",
    },
    plans: [],
  };
}

function makeApp() {
  const loaded = [];
  const app = createApp(siteData(), {
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

test("plans get readable titles from programme names", async () => {
  const data = siteData();
  const title = (code) => groupTitle(data, data.groups.find((g) => g.code === code));
  assert.equal(title("IGR_2N_s1"), "Inżynieria Górnicza, II stopień, niestacjonarne, semestr 1");
  assert.equal(title("240_INF-1S,7sem,po"), "Informatyka, I stopień, stacjonarne, semestr 7, po");
  // Bez semestru w kodzie zostaje nazwa grupy z USOSweb.
  assert.equal(title("000-HES-1S"), "Grupa przedmiotów HES");
  const { app } = makeApp();
  await app.openPlan("IGR_2N_s1");
  assert.equal(app.activePlans()[0].title, "Inżynieria Górnicza, II stopień, niestacjonarne, semestr 1");
});

test("tree shows only groups with classes, per faculty", () => {
  const [civil, foundry, informatics, general] = groupTree(siteData());
  assert.deepEqual(civil.programmes.map((p) => p.label), ["Inżynieria Górnicza, II stopień, niestacjonarne"]);
  assert.equal(foundry.total, 0);
  const zbi = informatics.programmes.find((p) => p.code === "ZBI");
  // Semestr 4 nie ma zajęć w cyklu strony, więc nie ma go w drzewie.
  assert.deepEqual(zbi.years.map((y) => [y.year, y.semesters.map((s) => s.label)]), [
    [1, ["semestr 1, zimowy"]],
    [2, ["semestr 3, zimowy"]],
  ]);
  const inf = informatics.programmes.find((p) => p.code === "INF");
  assert.deepEqual(inf.years.map((y) => y.semesters.map((s) => s.label)), [["semestr 2, letni"], ["semestr 7, zimowy, po"]]);
  assert.deepEqual(general.other.map((g) => g.code), ["000-HES-1S"]);
});

test("tree keys are unique across faculties and lead to the plan", () => {
  const data = siteData();
  assert.deepEqual(treePath(data, "240-ZBI-1S-2R-Z"), ["240-000", "240-000|ZBI|1S", "240-000|ZBI|1S|2"]);
  assert.deepEqual(treePath(data, "000-HES-1S"), ["000-000", "000-000|inne"]);
});

test("search matches programme names and lists groups with classes first", () => {
  const found = searchGroups(siteData(), "informatyka");
  assert.deepEqual(found.map((g) => [g.code, g.available]), [
    ["240_INF-1S,7sem,po", true],
    ["240-INF-1S-1R-L", true],
    ["240-ZBI-1S-1R-Z", true],
    ["240-ZBI-1S-2R-Z", true],
    ["240-ZBI-1S-2R-L", false],
  ]);
  assert.deepEqual(searchGroups(siteData(), "gornicza").map((g) => g.code), ["IGR_2N_s1"]);
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

test("without a link no plan is selected", async () => {
  const { app } = makeApp();
  assert.equal(await app.restore(), null);
  assert.equal(app.state.plans.length, 0);
});

test("state is saved to the address after a change", async () => {
  const { app } = makeApp();
  await app.openPlan("240-ZBI-1S-2R-Z");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(location.hash.length > 1);
});
