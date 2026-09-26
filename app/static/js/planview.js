// Strona planu: komponent Alpine.js nad modelem z model.js.
//
// Model nie jest reaktywny. Po każdej zmianie komponent składa z niego
// zamrożony opis widoku (`s`), a szablon plan.html tylko go wyświetla.
// Zamrożone obiekty Alpine zostawia bez proxy, więc bloczki przekazane
// z powrotem do modelu są tymi samymi obiektami, które model utworzył.

import Alpine from "../vendor/alpinejs/alpine-3.17.4.esm.min.js";
import {
  DAY_NAMES,
  addDays,
  createApp,
  dayAccusative,
  groupTree,
  groupUrl,
  historyOf,
  minutes,
  mondayOf,
  personUrl,
  plural,
  searchGroups,
  shortDate,
  stamp,
  statusMessage,
  subjectUrl,
  treePath,
} from "./model.js";
import { decodeState } from "./share.js";
import {
  THEMES,
  applyTheme,
  capitalize,
  copy,
  loadCycle,
  loadIndex,
  loadPlan,
  readTheme,
  rememberView,
  tone,
  typing,
} from "./ui.js";

const PARITY_SHORT = { odd: "N", even: "P" };
const HOUR_PX = 52;
const LINE_PX = 14;
const MONTH_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

let app;
let index;
// Plany, dla których drzewo ma już rozwiniętą ścieżkę. Rozwijamy ją tylko
// przy zmianie planów, żeby inne zmiany nie ruszały drzewa.
let shownPlans = "";
let shareTimer;
const SHARE_NOTICE_MS = 4000;

Alpine.data("planPage", () => ({
  s: null,
  failure: "",
  loading: false,
  problem: "",
  query: "",
  historyScope: "all",
  shareText: "",
  shareUrl: "",
  theme: readTheme(),
  themes: THEMES,
  tree: [],
  open: {},

  async init() {
    applyTheme(this.theme);
    const slow = setTimeout(() => (this.loading = true), 300);
    try {
      index = await loadIndex();
      const cycle = await chooseCycle(index);
      const cycleData = await loadCycle(cycle);
      app = createApp(
        { ...cycleData, faculties: index.faculties, groups: index.groups, programmes: index.programmes, plans: [] },
        { loadPlan },
      );
      this.problem = (await app.restore()) ?? "";
    } catch (error) {
      this.failure = `Nie udało się wczytać danych strony. ${error.message}`;
      return;
    } finally {
      clearTimeout(slow);
      this.loading = false;
    }
    this.tree = Object.freeze(groupTree(app.data));
    app.onChange(() => this.refresh());
    document.addEventListener("keydown", (event) => this.onKey(event));
    // Link „Udostępnij” wklejony w karcie z otwartym planem zmienia tylko
    // część po #, a przeglądarka nie wczytuje wtedy strony od nowa. Nasze
    // własne zapisy stanu (history.replaceState) tego zdarzenia nie wywołują.
    addEventListener("hashchange", () => location.reload());
    this.refresh();
  },

  refresh() {
    if (!app.state.plans.length) {
      this.s = null;
      return;
    }
    const plans = app.activePlans();
    const codes = plans.map((p) => p.code).join("+");
    if (codes !== shownPlans) {
      shownPlans = codes;
      for (const plan of plans) for (const key of treePath(app.data, plan.code)) this.open[key] = true;
    }
    app.shareUrl().then((url) => rememberView(plans, url.split("#")[1]));
    document.title = `${plans.map((p) => p.code).join(" + ")} · Plan na tydzień`;
    this.s = Object.freeze(snapshot(this.historyScope));
  },

  onKey(event) {
    if (typing(event) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape" && app.focus) app.select(null);
    if (app.state.mode !== "week") return;
    if (event.key === "ArrowLeft") app.shiftWeek(-1);
    if (event.key === "ArrowRight") app.shiftWeek(1);
  },

  // ----- akcje -----
  setMode: (mode) => app.setMode(mode),
  setParity: (parity) => app.setParity(parity),
  shiftWeek: (delta) => app.shiftWeek(delta),
  toggleSubject: (code) => app.toggleSubject(code),
  toggleType: (code, type) => app.toggleType(code, type),
  chooseGroup: (code, type, group) => app.chooseGroup(code, type, group),
  showAll: () => app.showAll(),
  removePlan: (code) => app.removePlan(code),
  select: (unit) => app.select(unit && app.isFocused(unit) ? null : unit),
  close: () => app.select(null),
  hideSubject(code) {
    app.select(null);
    app.toggleSubject(code);
  },
  hideType(code, type) {
    app.select(null);
    app.toggleType(code, type);
  },
  async openPlan(code) {
    await this.withPlan(() => app.openPlan(code));
    this.query = "";
  },
  async addPlan(code) {
    await this.withPlan(() => app.addPlan(code));
    this.query = "";
  },
  async withPlan(action) {
    this.problem = "";
    try {
      await action();
    } catch (error) {
      this.problem = `Nie udało się wczytać planu. ${error.message}`;
    }
  },
  setTheme(theme) {
    this.theme = theme;
    applyTheme(theme);
  },
  setHistoryScope(scope) {
    this.historyScope = scope;
    this.refresh();
  },
  async share() {
    const url = await app.shareUrl();
    const copied = await copy(url);
    this.shareText = copied ? "Link skopiowany." : "";
    this.shareUrl = copied ? "" : url;
    clearTimeout(shareTimer);
    if (copied) shareTimer = setTimeout(() => (this.shareText = ""), SHARE_NOTICE_MS);
    else this.$nextTick(() => this.$refs.shareField?.select());
  },
  toggleNode(key, el) {
    this.open[key] = el.open;
  },

  // ----- wyszukiwarka -----
  // Zapytanie czytamy zawsze, także przed wczytaniem danych: inaczej Alpine
  // nie zapisze zależności od niego i wyniki się nie odświeżą.
  get results() {
    const query = this.query;
    return app ? searchGroups(app.data, query) : [];
  },
  isActive(code) {
    return Boolean(this.s?.active.includes(code));
  },
}));

Alpine.start();

// Cykl: z linku (?cykl= albo tokenu „Udostępnij”), inaczej najnowszy w danych.
async function chooseCycle(index) {
  const known = new Set(index.cycles.map((c) => c.id));
  const params = new URLSearchParams(location.search);
  if (known.has(params.get("cykl"))) return params.get("cykl");
  const token = location.hash.slice(1);
  if (token) {
    try {
      const state = await decodeState(token);
      const cycle = state.plans[0]?.cycle;
      if (known.has(cycle)) return cycle;
    } catch {
      // Uszkodzony token zgłosi app.restore().
    }
  }
  return index.cycles.at(-1).id;
}

// ---------- opis widoku ----------

function snapshot(historyScope) {
  const plans = app.activePlans();
  const { mode, parity, week } = app.state;
  const term = app.data.term;
  const status = app.status();
  const view = mode === "week" ? app.calendarWeek() : app.typicalWeek();
  return {
    plans: plans.map((p, i) => ({ code: p.code, title: p.title, usosUrl: p.usosUrl, history: Boolean(p.history), tone: tone(`plan-${i}`), n: i + 1 })),
    multi: plans.length > 1,
    active: plans.map((p) => p.code),
    term: term.name,
    fetchedAt: stamp(plans[0].fetchedAt),
    usosUrl: plans[0].usosUrl,
    mode,
    parity,
    weekLabel: app.weekLabel(),
    canPrev: addDays(week, -7) >= mondayOf(term.start),
    canNext: addDays(week, 7) <= term.end,
    notice: status.kind === "ok" ? null : { text: statusMessage(status.kind, status.plan), usosUrl: status.kind === "empty" ? status.plan.usosUrl : null },
    legend: legend(),
    hasHistory: app.historyPlans().length > 0,
    subjects: app.subjects().map((s) => ({ ...s, types: s.types.map((t) => ({ ...t, tone: tone(`type-${t.type}`) })) })),
    hidden: app.hiddenCount(),
    grid: grid(view),
    details: details(),
    history: history(historyScope),
  };
}

// Przedmioty blokowe są kreskowane, bo ich zajęcia to tylko zaślepki.
function fillClass(activity) {
  const key = app.colorKey(activity);
  return activity.block && key.startsWith("type-") ? "fill-hatch" : tone(key);
}

function legend() {
  const merged = app.merged();
  const onlyBlocks = (type) => merged.filter((a) => a.type === type).every((a) => a.block);
  return app.legend().map((item) => ({
    ...item,
    cls: item.key.startsWith("type-") && onlyBlocks(item.key.slice(5)) ? "fill-hatch" : tone(item.key),
  }));
}

function dayMeta(day) {
  const parts = [];
  if (day.date) parts.push(shortDate(day.date));
  if (day.weekNo) parts.push(`tydz. ${day.weekNo} ${PARITY_SHORT[day.parity]}`);
  return parts.join(" · ");
}

function dayNote(day) {
  if (day.outside) return "poza semestrem";
  if (day.dayOff) return "dzień wolny";
  if (day.beforeClasses) return "przed początkiem zajęć";
  if (day.afterClasses) return "sesja, bez zajęć";
  return null;
}

// „2 kolizje”, a gdy wszystkie są w tych samych tygodniach, „1 kolizja, tyg. N”.
function clashCount(day) {
  if (!day.conflicts) return "";
  const count = `${day.conflicts} ${plural(day.conflicts, "kolizja", "kolizje", "kolizji")}`;
  const weeks = new Set(day.conflictPairs.map((p) => p.weeks));
  if (app.state.mode === "week" || weeks.size !== 1 || weeks.has("both")) return count;
  return `${count}, tyg. ${PARITY_SHORT[[...weeks][0]]}`;
}

function grid(view) {
  const { from, to } = app.hours();
  const span = to - from;
  const week = app.state.mode === "week";
  const axis = [];
  for (let m = from; m < to; m += 60) axis.push({ label: String(m / 60), style: `top: ${((m - from) / span) * 100}%` });
  return {
    columns: `--days: ${view.days.length}`,
    height: `height: calc(var(--hour) * ${span / 60})`,
    axis,
    days: view.days.map((day) => {
      const note = week ? dayNote(day) : null;
      const items = [...day.items].sort((x, y) => x.activity.start.localeCompare(y.activity.start));
      return {
        key: day.date ?? String(day.weekday),
        title: capitalize(day.name),
        // Dzień wolny z pojedynczymi zajęciami (np. 11.11) też dostaje opis.
        meta: [dayMeta(day), day.items.length ? note : null].filter(Boolean).join(" · "),
        swap: day.swapFrom === null || day.swapFrom === undefined ? "" : `zajęcia jak w ${dayAccusative(day.swapFrom)}`,
        clash: clashCount(day),
        off: Boolean(note),
        empty: day.items.length ? "" : (note ?? "brak zajęć"),
        blocks: day.items.map((item) => block(item, from, span)),
        agenda: items.map((item) => ({
          id: item.activity.id,
          activity: item.activity,
          time: `${item.activity.start}–${item.activity.end}`,
          name: item.activity.subjectName,
          fill: `swatch ${fillClass(item.activity)}`,
          line: `${item.activity.type} ${app.groupsLabel(item.activity)} · ${app.lecturersLabel(item.activity)}`,
          conflict: item.conflict,
        })),
      };
    }),
  };
}

function block(item, from, span) {
  const a = item.activity;
  const length = minutes(a.end) - minutes(a.start);
  const parity = a.recurrence === "odd" || a.recurrence === "even" ? ` · ${PARITY_SHORT[a.recurrence]}` : "";
  const spanInfo = app.state.mode === "typical" ? app.span(a) : null;
  // Nazwa dostaje tyle linii, ile zostaje po typie, prowadzącym i zakresie dat.
  let budget = Math.floor(((length / 60) * HOUR_PX - 6) / LINE_PX) - 2;
  const showSpan = Boolean(spanInfo?.partial) && budget >= 1;
  if (showSpan) budget -= 1;
  const showWho = budget >= 1;
  if (showWho) budget -= 1;
  const lines = 1 + Math.max(0, Math.min(budget, 2));
  const classes = ["block", fillClass(a)];
  if (item.conflict) classes.push("is-clash");
  if (app.isFocused(a)) classes.push("is-selected");
  let who = "";
  if (showWho) {
    if (a.block) who = "blok, grupę wybierasz osobno";
    else if (a.members.length > 1) who = `${a.lecturers.length} ${plural(a.lecturers.length, "prowadzący", "prowadzących", "prowadzących")}`;
    else who = app.lecturersLabel(a);
  }
  return {
    id: a.id,
    activity: a,
    cls: classes.join(" "),
    style: [
      `top: ${((minutes(a.start) - from) / span) * 100}%`,
      `height: ${(length / span) * 100}%`,
      `left: calc(${(item.lane / item.lanes) * 100}% + 2px)`,
      `width: calc(${100 / item.lanes}% - 4px)`,
    ].join("; "),
    label: `${a.subjectName}, ${app.typeName(a.type)}, ${app.groupsLabel(a)}, ${a.start}–${a.end}${item.conflict ? ", kolizja" : ""}`,
    name: a.subjectName,
    lines: lines > 1 ? `lines-${lines}` : "",
    type: a.type,
    meta: ` ${app.groupsLabel(a)}${parity}${a.changedTime ? " · zmiana godzin" : ""}`,
    who,
    span: showSpan ? spanInfo.label : "",
    changed: a.members.some((m) => app.changesFor(m).length),
  };
}

// ---------- szczegóły ----------

function lecturers(activity) {
  return activity.lecturers.map((p) => ({ name: p.name, url: p.id ? personUrl(p.id) : null }));
}

function datesByMonth(unit) {
  const months = new Map();
  for (const date of app.allDates(unit)) {
    const key = date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(+date.slice(8, 10));
  }
  return [...months.entries()].map(([key, days]) => `${MONTH_SHORT[+key.slice(5, 7) - 1]}: ${days.join(", ")}`);
}

function details() {
  const unit = app.focus;
  if (!unit) return null;
  const single = unit.members.length === 1;
  const spanInfo = app.span(unit);
  return {
    unit,
    title: unit.subjectName,
    subject: unit.subject,
    subjectUrl: subjectUrl(unit.subject),
    kind: `${app.typeName(unit.type)}, ${app.groupsLabel(unit)}`,
    when: `${capitalize(DAY_NAMES[unit.weekday])} ${unit.start}–${unit.end}${unit.date ? `, ${shortDate(unit.date)}` : ""}`,
    changedTime: Boolean(unit.changedTime),
    recurrence: app.recurrenceLabel(unit),
    single,
    block: unit.block,
    lecturers: lecturers(unit),
    place: app.place(unit) ?? "sala nieznana",
    meetings: spanInfo ? `${spanInfo.countLabel}, ${shortDate(spanInfo.first)}–${shortDate(spanInfo.last)}` : "",
    sources: app.activePlans().length > 1 ? app.sourcesLabel(unit) : "",
    members: single
      ? []
      : unit.members.map((m) => ({
          group: m.group,
          subject: m.subject,
          type: m.type,
          title: `Grupa ${m.group}${m.recurrence === "odd" ? ", tyg. nieparzyste" : m.recurrence === "even" ? ", tyg. parzyste" : ""}`,
          block: m.block,
          lecturers: lecturers(m),
          place: app.place(m) ?? "sala nieznana",
        })),
    clashes: app.conflictsOf(unit).map((c) => app.describeClash(unit, c)),
    changes: unit.members.flatMap((m) =>
      app.changesFor(m).map((c) => {
        const d = app.describeChange(c);
        return { title: `gr. ${c.group}: ${d.title}`, when: stamp(c.detectedAt), rows: d.rows };
      }),
    ),
    dates: datesByMonth(unit),
    groupUrl: groupUrl(unit),
  };
}

// ---------- historia ----------

function history(scope) {
  const plans = app.historyPlans();
  if (!plans.length) {
    return {
      plans: [],
      tracked: app.data.groups.filter((g) => g.plans.some((p) => p.history)).map((g) => g.code),
    };
  }
  const visible = new Set(app.visible().map((a) => `${a.unit}|${a.group}`));
  return {
    tracked: [],
    plans: plans.map((plan) => {
      const { baseline, changes: all } = historyOf(plan);
      const changes = all.filter((c) => scope === "all" || visible.has(`${c.unit}|${c.group}`));
      const lead = [`Porównanie ${plan.code} z migawką z ${stamp(baseline.at)}${baseline.note ? ` (${baseline.note})` : ""}.`];
      lead.push(all.length ? `Ostatnia wykryta zmiana: ${stamp(all.at(-1).detectedAt)}.` : "Od tej pory plan się nie zmienił.");
      lead.push("Plan sprawdzamy co 6 godzin.");
      return {
        code: plan.code,
        lead: lead.join(" "),
        total: all.length,
        rows: changes.map((c) => {
          const d = app.describeChange(c);
          return {
            key: `${c.unit}|${c.group}|${c.detectedAt}`,
            when: stamp(c.detectedAt),
            subject: c.subjectName,
            what: `${c.type} gr. ${c.group}`,
            title: d.title,
            was: d.rows.map((r) => r.before ?? ""),
            is: d.rows.map((r) => r.after ?? "usunięte"),
          };
        }),
      };
    }),
  };
}
