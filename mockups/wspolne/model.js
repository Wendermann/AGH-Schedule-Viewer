// Wspólna logika trzech makiet: dane, stan widoku, tydzień typowy
// i kalendarzowy, historia zmian, link „Udostępnij”.
//
// Makiety różnią się tylko prezentacją. Ukrywanie, łączenie i kolizje
// pochodzą z app/static/js/plan.js, a token stanu z share.js (oba pliki
// są kopiowane obok tego modułu przy budowie strony).

import {
  clashWeeks,
  emptySelection,
  isVisible,
  mergePlans,
  placeDay,
  typeKey,
} from "./plan.js";
import { decodeState, encodeState } from "./share.js";

export const USOS = "https://web.usos.agh.edu.pl/kontroler.php";
export const DAY_NAMES = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];
export const DAY_SHORT = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];
const DAY_ACCUSATIVE = ["poniedziałek", "wtorek", "środę", "czwartek", "piątek", "sobotę", "niedzielę"];
const MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];
const RECURRENCE = {
  weekly: "co tydzień",
  odd: "co dwa tygodnie, nieparzyste",
  even: "co dwa tygodnie, parzyste",
  irregular: "w wybrane dni",
  mixed: "grupy w różne tygodnie",
};
const LEVELS = { "1S": "I stopień, stacjonarne", "2S": "II stopień, stacjonarne", "1N": "I stopień, niestacjonarne", "2N": "II stopień, niestacjonarne" };
// Dłuższy odstęp od początku lub końca zajęć w semestrze oznacza zajęcia
// krótsze niż semestr. Dwa tygodnie mieszczą przesunięcie grup parzystych.
const PARTIAL_MARGIN_DAYS = 14;

// ---------- daty ----------

const MS_DAY = 86400000;
const toUtc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso, n) => fromUtc(toUtc(iso) + n * MS_DAY);
export const diffDays = (a, b) => Math.round((toUtc(a) - toUtc(b)) / MS_DAY);
export const weekdayOf = (iso) => (new Date(toUtc(iso)).getUTCDay() + 6) % 7;
export const mondayOf = (iso) => addDays(iso, -weekdayOf(iso));
export const shortDate = (iso) => `${+iso.slice(8, 10)}.${iso.slice(5, 7)}`;
export const longDate = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
export const minutes = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);
export const dayAccusative = (weekday) => DAY_ACCUSATIVE[weekday];
// „przeniesione ze środy na poniedziałek”
export const fromDay = (weekday) =>
  ["z poniedziałku", "z wtorku", "ze środy", "z czwartku", "z piątku", "z soboty", "z niedzieli"][weekday];

export function plural(n, one, few, many) {
  if (n === 1) return one;
  const tens = n % 100;
  const units = n % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}

// Znacznik czasu z przesunięciem strefy pokazujemy w czasie Krakowa. Monitor
// zapisywał czas lokalny bez strefy, więc taki bierzemy dosłownie.
export function stamp(iso) {
  if (/[zZ]|[+-]\d\d:\d\d$/.test(iso)) {
    const parts = new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw", day: "numeric", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(iso));
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("day")}.${get("month")}.${get("year")}, ${get("hour")}:${get("minute")}`;
  }
  return `${+iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}, ${iso.slice(11, 16)}`;
}

// ---------- adresy USOS ----------

export const groupUrl = (a) => `${USOS}?_action=katalog2/przedmioty/pokazZajecia&zaj_cyk_id=${a.unit}&gr_nr=${a.group}`;
export const personUrl = (id) => `${USOS}?_action=katalog2/osoby/pokazOsobe&os_id=${id}`;
export const subjectUrl = (code) => `${USOS}?_action=katalog2/przedmioty/pokazPrzedmiot&prz_kod=${encodeURIComponent(code)}`;

// ---------- drzewo kierunków ----------

const REGULAR_CODE = /^(\d{3})-([A-Z]{2,4})-([12][SN])-([1-9])R-([ZL])$/;

function programmeName(name) {
  return name
    .replace(/^\d{3}\s*[-_ ]\s*/, "")
    .replace(/,?\s*(stacjonarne,?\s*)?(II st\.,?\s*)?(semestr\s*\d+|\d+\s*semestr)\s*$/i, "")
    .replace(/\s*-\s*/g, " – ")
    .trim();
}

function semesterNumber(group, year, season) {
  const found = group.name.match(/semestr\s*(\d+)|(\d+)\s*semestr/i);
  return found ? +(found[1] ?? found[2]) : (year - 1) * 2 + (season === "Z" ? 1 : 2);
}

// Wydział → kierunek (ze stopniem) → rok → semestr. Grupy o nietypowych
// kodach trafiają do gałęzi „Inne” swojego wydziału.
export function groupTree(data) {
  const available = new Set(data.plans.map((p) => p.code));
  return data.faculties.map((faculty) => {
    const groups = data.groups.filter((g) => g.faculty === faculty.code);
    const programmes = new Map();
    const other = [];
    for (const group of groups) {
      const match = group.code.match(REGULAR_CODE);
      const leaf = { code: group.code, name: group.name, available: available.has(group.code) };
      if (!match) {
        other.push(leaf);
        continue;
      }
      const [, , programme, level, year, season] = match;
      const key = `${programme}-${level}`;
      if (!programmes.has(key)) {
        programmes.set(key, { key, code: programme, level: LEVELS[level] ?? level, names: [], years: new Map() });
      }
      const node = programmes.get(key);
      node.names.push(programmeName(group.name));
      if (!node.years.has(+year)) node.years.set(+year, []);
      node.years.get(+year).push({
        ...leaf,
        semester: semesterNumber(group, +year, season),
        season: season === "Z" ? "zimowy" : "letni",
      });
    }
    const list = [...programmes.values()].map((node) => ({
      key: node.key,
      code: node.code,
      level: node.level,
      // Nazwy tego samego kierunku różnią się wielkością liter; bierzemy
      // wersję z najmniejszą liczbą wielkich liter.
      name: node.names.sort((a, b) => capitals(a) - capitals(b))[0],
      years: [...node.years.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, leaves]) => ({ year, semesters: leaves.sort((a, b) => a.semester - b.semester) })),
    }));
    list.sort((a, b) => a.name.localeCompare(b.name, "pl") || a.level.localeCompare(b.level, "pl"));
    return { ...faculty, loaded: groups.length > 0, programmes: list, other };
  });
}

const capitals = (text) => (text.match(/\p{Lu}/gu) ?? []).length;

const fold = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLowerCase();

export function searchGroups(data, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const available = new Set(data.plans.map((p) => p.code));
  return data.groups
    .filter((g) => words.every((w) => fold(`${g.code} ${g.name}`).includes(w)))
    .map((g) => ({ ...g, available: available.has(g.code) }))
    .slice(0, 12);
}

// ---------- komunikaty o stanie danych ----------

export const STATUSES = ["ok", "cache", "sync", "error", "empty"];
export const STATUS_LABELS = {
  ok: "dane aktualne",
  cache: "dane z kopii",
  sync: "synchronizacja w USOS",
  error: "USOS niedostępny",
  empty: "plan bez zajęć",
};

export function statusMessage(status, data, plan) {
  const when = stamp(data.fetchedAt);
  switch (status) {
    case "cache":
      return `Ostatnie odświeżenie się nie udało, bo USOS nie odpowiadał. Pokazuję dane pobrane ${when}.`;
    case "sync":
      return `W USOS trwa synchronizacja baz danych, więc plan może być niepełny. Pokazuję dane sprzed synchronizacji, pobrane ${when}.`;
    case "error":
      return "USOS nie odpowiada, a tego planu nie mamy jeszcze zapisanego. Spróbuj za kilka minut albo otwórz plan bezpośrednio w USOSweb.";
    case "empty":
      return `W cyklu ${data.term.id} grupa przedmiotów ${plan?.code ?? ""} nie ma żadnych zajęć. USOS pokazuje wtedy pusty plan, na przykład dla semestrów, które już się nie odbywają.`;
    default:
      return `Dane z USOS pobrane ${when}.`;
  }
}

// ---------- aplikacja ----------

export async function loadData(url = "dane/plany.json") {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nie udało się wczytać ${url} (HTTP ${response.status}).`);
  return response.json();
}

const planKey = (plan) => `g:${plan.code}@${plan.cycle}`;

export function createApp(data, { storageKey }) {
  const plansByCode = new Map(data.plans.map((p) => [p.code, p]));
  const listeners = new Set();
  const today = new Date().toISOString().slice(0, 10);
  const defaultWeek = mondayOf(
    today >= data.calendar.firstClass && today <= data.calendar.lastClass ? today : data.calendar.firstClass,
  );

  const app = {
    data,
    state: {
      plans: [{ kind: "g", code: data.plans[0].code, cycle: data.plans[0].cycle }],
      selection: emptySelection(),
      mode: "typical",
      parity: "all",
      week: defaultWeek,
    },
    // Tylko w makiecie: podgląd zaprojektowanych stanów danych.
    status: "ok",
    focus: null,

    onChange(listener) {
      listeners.add(listener);
    },
    emit(reason = "state") {
      for (const listener of listeners) listener(reason);
      if (reason !== "focus") persist();
    },

    // ----- plany -----
    activePlans() {
      return app.state.plans
        .map((ref, index) => ({ ...plansByCode.get(ref.code), key: planKey(ref), index }))
        .filter((plan) => plan.code);
    },
    isActive(code) {
      return app.state.plans.some((p) => p.code === code);
    },
    addPlan(code) {
      const plan = plansByCode.get(code);
      if (!plan || app.isActive(code)) return;
      app.state.plans.push({ kind: "g", code, cycle: plan.cycle });
      app.emit();
    },
    removePlan(code) {
      if (app.state.plans.length === 1) return;
      app.state.plans = app.state.plans.filter((p) => p.code !== code);
      app.emit();
    },
    openPlan(code) {
      const plan = plansByCode.get(code);
      if (!plan) return;
      app.state.plans = [{ kind: "g", code, cycle: plan.cycle }];
      app.state.selection = emptySelection();
      app.emit();
    },
    merged() {
      return mergePlans(app.activePlans().map((plan) => ({ key: plan.key, activities: plan.activities })));
    },
    // Kolor oznacza typ zajęć przy jednym planie i plan źródłowy po połączeniu.
    colorKey(activity) {
      const plans = app.activePlans();
      if (plans.length < 2) return `type-${activity.type}`;
      if (activity.sources.length > 1) return "plan-shared";
      return `plan-${plans.findIndex((p) => p.key === activity.sources[0])}`;
    },
    legend() {
      const plans = app.activePlans();
      if (plans.length > 1) {
        const items = plans.map((p, i) => ({ key: `plan-${i}`, label: p.name, short: String(i + 1) }));
        if (app.merged().some((a) => a.sources.length > 1)) {
          items.push({ key: "plan-shared", label: "wspólne dla kilku planów", short: "wsp." });
        }
        return items;
      }
      const types = [...new Set(app.merged().map((a) => a.type))];
      return types.map((type) => ({ key: `type-${type}`, label: data.classTypes[type] ?? type, short: type }));
    },

    // ----- ukrywanie -----
    subjects() {
      const bySubject = new Map();
      for (const activity of app.merged()) {
        if (!bySubject.has(activity.subject)) {
          bySubject.set(activity.subject, {
            code: activity.subject,
            name: activity.subjectName,
            block: activity.block,
            hidden: app.state.selection.hiddenSubjects.has(activity.subject),
            types: new Map(),
          });
        }
        const subject = bySubject.get(activity.subject);
        if (!subject.types.has(activity.type)) {
          const key = typeKey(activity.subject, activity.type);
          subject.types.set(activity.type, {
            type: activity.type,
            name: data.classTypes[activity.type] ?? activity.type,
            hidden: app.state.selection.hiddenTypes.has(key),
            chosen: app.state.selection.chosenGroups.get(key) ?? null,
            groups: new Set(),
          });
        }
        subject.types.get(activity.type).groups.add(activity.group);
      }
      return [...bySubject.values()]
        .map((s) => ({
          ...s,
          types: [...s.types.values()].map((t) => ({ ...t, groups: [...t.groups].sort((a, b) => a - b) })),
        }))
        .sort((a, b) => a.block - b.block || a.name.localeCompare(b.name, "pl"));
    },
    toggleSubject(code) {
      const hidden = app.state.selection.hiddenSubjects;
      hidden.has(code) ? hidden.delete(code) : hidden.add(code);
      app.emit();
    },
    toggleType(subject, type) {
      const hidden = app.state.selection.hiddenTypes;
      const key = typeKey(subject, type);
      hidden.has(key) ? hidden.delete(key) : hidden.add(key);
      app.emit();
    },
    chooseGroup(subject, type, group) {
      const chosen = app.state.selection.chosenGroups;
      const key = typeKey(subject, type);
      group === null || chosen.get(key) === group ? chosen.delete(key) : chosen.set(key, group);
      app.emit();
    },
    showAll() {
      app.state.selection = emptySelection();
      app.emit();
    },
    hiddenCount() {
      const s = app.state.selection;
      return s.hiddenSubjects.size + s.hiddenTypes.size + s.chosenGroups.size;
    },
    visible() {
      if (app.status === "error" || app.status === "empty") return [];
      return app.merged().filter((a) => isVisible(a, app.state.selection));
    },

    // ----- widok -----
    setMode(mode) {
      app.state.mode = mode;
      app.emit("view");
    },
    setParity(parity) {
      app.state.parity = parity;
      app.emit("view");
    },
    shiftWeek(delta) {
      const next = addDays(app.state.week, 7 * delta);
      if (next < mondayOf(data.term.start) || next > data.term.end) return;
      app.state.week = next;
      app.emit("week");
    },
    goToWeek(monday) {
      app.state.week = mondayOf(monday);
      app.emit("week");
    },
    setStatus(status) {
      app.status = status;
      app.emit("status");
    },
    // Zaznaczony bloczek (pojedyncze zajęcia albo kilka równoległych grup).
    select(unit) {
      app.focus = unit ?? null;
      app.emit("focus");
    },
    isFocused(unit) {
      return app.focus?.id === unit.id;
    },

    hours() {
      const all = app.activePlans().flatMap((p) => p.activities);
      if (!all.length) return { from: 8 * 60, to: 18 * 60 };
      const from = Math.min(...all.map((a) => minutes(a.start)));
      const to = Math.max(...all.map((a) => minutes(a.end)));
      return { from: Math.floor(from / 60) * 60, to: Math.ceil(to / 60) * 60 };
    },

    typicalWeek() {
      const parity = app.state.parity;
      const shown = app.visible().filter((a) => parity === "all" || a.recurrence !== (parity === "odd" ? "even" : "odd"));
      const last = shown.some((a) => a.weekday === 6) ? 6 : shown.some((a) => a.weekday === 5) ? 5 : 4;
      const days = Array.from({ length: last + 1 }, (_, weekday) => ({ weekday, name: DAY_NAMES[weekday] }));
      return layoutDays(shown, days, parityOf);
    },

    calendarWeek() {
      const monday = app.state.week;
      const cal = data.calendar;
      const occurrences = [];
      for (const activity of app.visible()) {
        for (const date of activity.dates) {
          if (date >= monday && date <= addDays(monday, 6)) {
            occurrences.push(occurrence(activity, date, activity.start, activity.end, false));
          }
        }
        for (const moved of activity.moved ?? []) {
          if (moved.date >= monday && moved.date <= addDays(monday, 6)) {
            occurrences.push(occurrence(activity, moved.date, moved.start, moved.end, true));
          }
        }
      }
      const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
        const date = addDays(monday, weekday);
        const info = app.weekInfo(date);
        return {
          weekday,
          date,
          name: DAY_NAMES[weekday],
          ...info,
          dayOff: cal.daysOff.includes(date),
          swapFrom: cal.swaps[date] ?? null,
          outside: date < data.term.start || date > data.term.end,
          beforeClasses: date < cal.firstClass,
          afterClasses: date > cal.lastClass && date <= data.term.end,
        };
      });
      const weekend = occurrences.some((o) => o.weekday >= 5);
      return layoutDays(occurrences, weekend ? days : days.slice(0, 5), parityOf);
    },

    // Tydzień semestru liczony od pierwszego dnia cyklu, po 7 dni. Tak AGH
    // wyznacza tygodnie parzyste i nieparzyste (docs/02-analiza-usos.md).
    weekInfo(date) {
      if (date < data.term.start || date > data.term.end) return { weekNo: null, parity: null };
      const weekNo = Math.floor(diffDays(date, data.term.start) / 7) + 1;
      return { weekNo, parity: weekNo % 2 ? "odd" : "even" };
    },
    weekLabel() {
      const monday = app.state.week;
      const sunday = addDays(monday, 6);
      const sameMonth = monday.slice(5, 7) === sunday.slice(5, 7);
      const from = sameMonth ? String(+monday.slice(8, 10)) : longDate(monday);
      return `${from}–${longDate(sunday)} ${sunday.slice(0, 4)}`;
    },

    // Zakres dat zajęć krótszych niż semestr, np. „2.10–30.10, 5 spotkań”.
    span(activity) {
      const base = activity.origin ?? activity;
      const dates = [...base.dates, ...(base.moved ?? []).map((m) => m.date)].sort();
      if (!dates.length) return null;
      const first = dates[0];
      const last = dates.at(-1);
      const lateStart = diffDays(first, data.calendar.firstClass) > PARTIAL_MARGIN_DAYS;
      const earlyEnd = diffDays(data.calendar.lastClass, last) > PARTIAL_MARGIN_DAYS;
      const count = `${dates.length} ${plural(dates.length, "spotkanie", "spotkania", "spotkań")}`;
      let label = null;
      if (earlyEnd) label = `${shortDate(first)}–${shortDate(last)}, ${count}`;
      else if (lateStart) label = `od ${shortDate(first)}, ${count}`;
      return { first, last, count: dates.length, countLabel: count, partial: Boolean(label), label };
    },

    recurrenceLabel(activity) {
      return RECURRENCE[activity.recurrence] ?? activity.recurrence;
    },
    typeName(type) {
      return data.classTypes[type] ?? type;
    },
    lecturersLabel(activity) {
      if (activity.block) return "blok, grupę wybierasz osobno";
      return activity.lecturers.map((p) => p.name).join(", ") || "prowadzący nieznany";
    },
    place(activity) {
      if (!activity.room) return null;
      return activity.room === "on-line" ? "zajęcia zdalne" : `sala ${activity.room}, bud. ${activity.building}`;
    },
    sourcesLabel(activity) {
      const names = new Map(app.activePlans().map((p) => [p.key, p.code]));
      return activity.sources.map((key) => names.get(key)).join(", ");
    },
    // Kolizje bloczka: z czym, w które tygodnie i których grup dotyczą.
    conflictsOf(unit) {
      const view = app.state.mode === "week" ? app.calendarWeek() : app.typicalWeek();
      const found = [];
      for (const day of view.days) {
        for (const pair of day.conflictPairs) {
          if (pair.a.id === unit.id) found.push({ other: pair.b, weeks: pair.weeks, mine: pair.groupsA, theirs: pair.groupsB });
          if (pair.b.id === unit.id) found.push({ other: pair.a, weeks: pair.weeks, mine: pair.groupsB, theirs: pair.groupsA });
        }
      }
      return found;
    },
    // „w tygodnie nieparzyste” itp.; w tygodniu kalendarzowym kolizja
    // dotyczy po prostu tego dnia, więc opis jest pusty.
    clashWeeksLabel(weeks) {
      if (app.state.mode === "week") return "";
      return { odd: "w tygodnie nieparzyste", even: "w tygodnie parzyste", both: "co tydzień" }[weeks] ?? "";
    },
    groupsLabel(unit) {
      if (unit.members.length === 1) return `gr. ${unit.group}`;
      return `gr. ${compactRange(unit.members.map((m) => m.group))}`;
    },

    // ----- historia -----
    historyPlans() {
      return app.activePlans().filter((p) => p.history);
    },
    changesFor(activity) {
      return app
        .historyPlans()
        .flatMap((p) => historyOf(p).changes)
        .filter((c) => c.unit === activity.unit && c.group === activity.group);
    },
    describeChange,
    describeTerm,
    // Wszystkie daty spotkań bloczka, także grup połączonych w jeden.
    allDates(unit) {
      const dates = unit.members.flatMap((m) => {
        const base = m.origin ?? m;
        return [...base.dates, ...(base.moved ?? []).map((c) => c.date)];
      });
      return [...new Set(dates)].sort();
    },

    // ----- link „Udostępnij” -----
    async shareUrl() {
      const token = await encodeState(app.state);
      return `${location.href.split("#")[0]}#${token}`;
    },
  };

  const parityOf = (date) => app.weekInfo(date).parity;

  // Opis jednej kolizji, np. „Fizyka 2, CWA gr. 1, 16:45–18:15, w tygodnie
  // nieparzyste (dotyczy gr. 1)”.
  app.describeClash = (unit, clash) => {
    const o = clash.other;
    const parts = [`${o.subjectName}, ${o.type} gr. ${compactRange(clash.theirs)}, ${o.start}–${o.end}`];
    const weeks = app.clashWeeksLabel(clash.weeks);
    if (weeks) parts.push(weeks);
    const text = parts.join(", ");
    return unit.members.length > 1 ? `${text} (dotyczy gr. ${compactRange(clash.mine)})` : text;
  };

  function persist() {
    encodeState(app.state).then((token) => {
      // W osadzonym podglądzie adres albo pamięć przeglądarki mogą być
      // niedostępne; wtedy stan żyje tylko do końca wizyty.
      try {
        history.replaceState(null, "", `#${token}`);
      } catch {}
      try {
        localStorage.setItem(storageKey, token);
      } catch {}
    });
  }

  app.restore = async function restore() {
    let token = location.hash.slice(1);
    if (!token) {
      try {
        token = localStorage.getItem(storageKey) ?? "";
      } catch {
        token = "";
      }
    }
    if (!token) return null;
    try {
      const state = await decodeState(token);
      state.plans = state.plans.filter((p) => plansByCode.has(p.code));
      if (!state.plans.length) return "Link wskazuje plan, którego nie ma w danych makiety. Pokazuję plan domyślny.";
      app.state = { ...state, week: state.week ?? defaultWeek };
      return null;
    } catch {
      return "Link „Udostępnij” jest uszkodzony albo pochodzi z nowszej wersji strony. Pokazuję plan domyślny.";
    }
  };

  return app;
}

// Historia z app/history.py: lista sprawdzeń, każde z własnymi zmianami.
export function historyOf(plan) {
  const checks = plan.history.checks;
  return { baseline: checks[0], latest: checks.at(-1), changes: checks.flatMap((c) => c.changes) };
}

export function occurrenceId(activity) {
  return [activity.subject, activity.type, activity.group, activity.unit, activity.originWeekday ?? activity.weekday, activity.start, activity.date ?? ""].join("|");
}

function occurrence(activity, date, start, end, changedTime) {
  return {
    ...activity,
    // Zajęcia z całego semestru, z których pochodzi to jedno spotkanie.
    origin: activity,
    originWeekday: activity.weekday,
    weekday: weekdayOf(date),
    start,
    end,
    date,
    dates: [date],
    changedTime,
  };
}

// „1, 2, 3, 4, 7” → „1–4, 7”.
export function compactRange(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j - i >= 2 ? `${sorted[i]}–${sorted[j]}` : sorted.slice(i, j + 1).join(", "));
    i = j;
  }
  return parts.join(", ");
}

// Równoległe grupy tego samego typu zajęć (np. cztery laboratoria o tej
// samej godzinie) to alternatywy, więc na planie tworzą jeden bloczek.
// Po wybraniu „mojej grupy” zostaje w nim tylko ona.
function bundle(activities) {
  const byKey = new Map();
  for (const activity of activities) {
    const key = [activity.subject, activity.type, activity.weekday, activity.start, activity.end, activity.date ?? ""].join("|");
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(activity);
  }
  return [...byKey.values()].map((members) => {
    members.sort((a, b) => a.group - b.group);
    const first = members[0];
    const unit = { ...first, members, id: members.map(occurrenceId).join("+") };
    if (members.length > 1) {
      const lecturers = new Map(members.flatMap((m) => m.lecturers).map((p) => [p.id, p]));
      unit.lecturers = [...lecturers.values()];
      unit.sources = [...new Set(members.flatMap((m) => m.sources))];
      unit.changedTime = members.some((m) => m.changedTime);
      if (members.some((m) => m.recurrence !== first.recurrence)) unit.recurrence = "mixed";
    }
    return unit;
  });
}

// Kolizje liczymy między bloczkami, ale z dokładnością do grup i tygodni:
// zajęcia w tygodnie nieparzyste nie kolidują z zajęciami w parzyste.
function layoutDays(activities, days, parityOf) {
  const units = bundle(activities);
  const pairs = [];
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const [a, b] = [units[i], units[j]];
      if (a.weekday !== b.weekday) continue;
      const weeks = new Set();
      const groupsA = new Set();
      const groupsB = new Set();
      for (const x of a.members) {
        for (const y of b.members) {
          const when = clashWeeks(x, y, parityOf);
          if (!when) continue;
          weeks.add(when);
          groupsA.add(x.group);
          groupsB.add(y.group);
        }
      }
      if (!weeks.size) continue;
      const only = weeks.size === 1 ? [...weeks][0] : "both";
      pairs.push({ a, b, weeks: only, groupsA: [...groupsA].sort((m, n) => m - n), groupsB: [...groupsB].sort((m, n) => m - n) });
    }
  }
  const clashing = new Set(pairs.flatMap((p) => [p.a.id, p.b.id]));
  return {
    days: days.map((day) => {
      const own = units.filter((u) => u.weekday === day.weekday);
      const dayPairs = pairs.filter((p) => p.a.weekday === day.weekday);
      return {
        ...day,
        items: placeDay(own).map((item) => ({ ...item, conflict: clashing.has(item.activity.id) })),
        conflictPairs: dayPairs,
        conflicts: dayPairs.length,
      };
    }),
    total: units.length,
  };
}

// ---------- opis zmian ----------

const FIELD_LABELS = { recurrence: "częstotliwość", lecturers: "prowadzący" };

export function describeTerm(term) {
  const parity = term.recurrence === "odd" ? ", tyg. nieparzyste" : term.recurrence === "even" ? ", tyg. parzyste" : "";
  const room = term.room ? (term.room === "on-line" ? ", zdalnie" : `, s. ${term.room} ${term.building ?? ""}`.trimEnd()) : "";
  const who = term.lecturers?.length ? `, ${term.lecturers.join(", ")}` : "";
  return `${DAY_SHORT[term.weekday]} ${term.start}–${term.end}${parity}${room}${who}`;
}

// Zmiana jako lista pól „było → jest” w zwykłych słowach.
export function describeChange(change) {
  if (change.kind !== "modified") {
    const terms = change.kind === "added" ? change.after : change.before;
    return { title: change.kind === "added" ? "nowe zajęcia" : "usunięte zajęcia", rows: terms.map((t) => ({ label: "termin", before: change.kind === "removed" ? describeTerm(t) : null, after: change.kind === "added" ? describeTerm(t) : null })) };
  }
  const before = change.before[0];
  const after = change.after[0];
  const rows = [];
  const fields = new Set(change.fields);
  if (fields.has("weekday") || fields.has("start") || fields.has("end")) {
    rows.push({ label: "termin", before: `${DAY_SHORT[before.weekday]} ${before.start}–${before.end}`, after: `${DAY_SHORT[after.weekday]} ${after.start}–${after.end}` });
  }
  if (fields.has("recurrence")) rows.push({ label: FIELD_LABELS.recurrence, before: RECURRENCE[before.recurrence], after: RECURRENCE[after.recurrence] });
  if (fields.has("room") || fields.has("building")) {
    const place = (t) => (t.room ? (t.room === "on-line" ? "zdalnie" : `s. ${t.room}, bud. ${t.building}`) : "brak sali");
    rows.push({ label: "sala", before: place(before), after: place(after) });
  }
  if (fields.has("lecturers")) rows.push({ label: FIELD_LABELS.lecturers, before: before.lecturers.join(", ") || "brak", after: after.lecturers.join(", ") || "brak" });
  const parts = [];
  if (fields.has("weekday")) parts.push(`przeniesione na ${DAY_ACCUSATIVE[after.weekday]}`);
  else if (fields.has("start") || fields.has("end")) parts.push("nowe godziny");
  if (fields.has("recurrence")) parts.push("inna częstotliwość");
  if (fields.has("room") || fields.has("building")) parts.push("nowa sala");
  if (fields.has("lecturers")) parts.push(after.lecturers.length > 1 ? "nowi prowadzący" : "nowy prowadzący");
  return { title: parts.join(", "), rows };
}
