import { applyTheme, copy, fill, h, keepFocus, readPreference, typing, writePreference } from "../wspolne/dom.js";
import { renderDemoBar } from "../wspolne/demo.js";
import {
  DAY_NAMES,
  createApp,
  plural,
  dayAccusative,
  groupTree,
  groupUrl,
  historyOf,
  loadData,
  minutes,
  personUrl,
  searchGroups,
  shortDate,
  stamp,
  statusMessage,
  subjectUrl,
} from "../wspolne/model.js";

const $ = (id) => document.getElementById(id);
const THEME_KEY = "rozklad-motyw";
const TYPES_WITH_COLOR = new Set(["W", "CWL", "CWA", "CWP"]);
const COLOR_KEY = "rozklad-kolor";
const COLOR_MODES = [
  ["fields", "pełne pola"],
  ["tints", "tinty z paskiem"],
  ["frames", "kolorowe obrysy"],
];
const PARITY_SHORT = { odd: "N", even: "P" };
const HOUR_PX = 52;
const LINE_PX = 14;

let app;
let query = "";
let historyScope = "all";
let shareText = "";
let theme = readPreference(THEME_KEY, "system");
let colorMode = readPreference(COLOR_KEY, "fields");
// Węzły drzewa kierunków rozwinięte przez użytkownika przetrwają przerysowanie.
const openNodes = new Set(["240-000"]);

boot();

async function boot() {
  applyTheme(theme);
  applyColorMode();
  const loading = setTimeout(() => ($("loading").hidden = false), 300);
  let data;
  try {
    data = await loadData("dane/plany.json");
  } catch (error) {
    clearTimeout(loading);
    fill($("notice"), h("p", {}, `Nie udało się wczytać danych makiety. ${error.message}`));
    $("notice").hidden = false;
    $("loading").hidden = true;
    return;
  }
  clearTimeout(loading);
  $("loading").hidden = true;
  app = createApp(data, { storageKey: "rozklad-stan" });
  const problem = await app.restore();
  if (problem) shareText = problem;
  app.onChange(() => keepFocus(render));
  document.addEventListener("keydown", onKey);
  renderDemo();
  render();
}

function applyColorMode() {
  document.body.classList.remove(...COLOR_MODES.map(([mode]) => `color-${mode}`));
  document.body.classList.add(`color-${colorMode}`);
}

function renderDemo() {
  const select = h(
    "select",
    {
      id: "demo-color",
      onchange: (e) => {
        colorMode = e.target.value;
        writePreference(COLOR_KEY, colorMode);
        applyColorMode();
      },
    },
    COLOR_MODES.map(([mode, label]) => h("option", { value: mode, selected: mode === colorMode }, label)),
  );
  renderDemoBar($("demo"), app, { current: "szwajcarska.html", extra: [h("label", {}, "Kolor ", select)] });
}

// Klasa barwy dla klucza z app.colorKey() albo z legendy.
function tone(key) {
  if (key === "plan-shared") return "fill-hatch";
  if (key.startsWith("plan-")) return `tone pl-${+key.slice(5) % 4}`;
  const type = key.slice(5);
  return `tone ty-${TYPES_WITH_COLOR.has(type) ? type : "other"}`;
}

function onKey(event) {
  if (typing(event) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "Escape" && app.focus) app.select(null);
  if (app.state.mode !== "week") return;
  if (event.key === "ArrowLeft") app.shiftWeek(-1);
  if (event.key === "ArrowRight") app.shiftWeek(1);
}

let shownPlans = "";

function render() {
  const plans = app.state.plans.map((p) => p.code).join(",");
  if (plans !== shownPlans) {
    shownPlans = plans;
    for (const plan of app.state.plans) openPath(plan.code);
  }
  renderMasthead();
  renderToolbar();
  renderIndex();
  renderSheet();
  renderDetails();
  renderHistory();
  renderColophon();
}

// ---------- nagłówek ----------

function renderMasthead() {
  const plans = app.activePlans();
  fill(
    $("plan-title"),
    plans.map((plan, i) =>
      h(
        "div",
        { class: `plan-chip is-${i}` },
        plans.length > 1 ? h("b", { class: tone(`plan-${i}`), "aria-hidden": "true" }, i + 1) : null,
        h("div", {}, h("h1", {}, plan.name), h("span", { class: "code" }, `${plan.code} · ${app.data.term.name}`)),
      ),
    ),
  );
  $("status").textContent = app.status === "ok" ? `Dane z USOS: ${stamp(app.data.fetchedAt)}` : "";
}

// ---------- pasek sterowania ----------

function segment(label, options, current, onPick) {
  return h(
    "div",
    { class: "seg", role: "group", "aria-label": label },
    h("span", { class: "seg__label" }, label),
    options.map(([value, text]) =>
      h("button", { type: "button", "aria-pressed": String(value === current), onclick: () => onPick(value) }, text),
    ),
  );
}

function renderToolbar() {
  const { mode, parity } = app.state;
  const week = mode === "week";
  fill(
    $("toolbar"),
    segment("Widok", [["typical", "tydzień typowy"], ["week", "tydzień kalendarzowy"]], mode, app.setMode),
    week
      ? h(
          "div",
          { class: "week-nav" },
          h("button", { type: "button", "aria-label": "Poprzedni tydzień", onclick: () => app.shiftWeek(-1) }, "←"),
          h("span", { class: "week-nav__label", "aria-live": "polite" }, app.weekLabel()),
          h("button", { type: "button", "aria-label": "Następny tydzień", onclick: () => app.shiftWeek(1) }, "→"),
        )
      : segment("Tygodnie", [["all", "wszystkie"], ["odd", "nieparzyste"], ["even", "parzyste"]], parity, app.setParity),
    h(
      "div",
      { class: "toolbar__end" },
      segment("Motyw", [["system", "systemowy"], ["light", "jasny"], ["dark", "ciemny"]], theme, (value) => {
        theme = value;
        writePreference(THEME_KEY, value);
        applyTheme(value);
        renderToolbar();
      }),
      h("button", { type: "button", class: "text-button", onclick: share }, "Udostępnij"),
      shareText ? h("span", { class: "share-out", role: "status" }, shareText) : null,
    ),
  );
}

async function share() {
  const url = await app.shareUrl();
  shareText = (await copy(url)) ? "Link skopiowany." : "";
  renderToolbar();
  if (!shareText) {
    const out = h("input", { value: url, readonly: true, "aria-label": "Link do tego widoku" });
    $("toolbar").querySelector(".toolbar__end").append(h("span", { class: "share-out" }, out));
    out.select();
  }
}

// ---------- indeks: wybór planu i przedmiotów ----------

function renderIndex() {
  const hadFocus = document.activeElement?.id === "search";
  fill(
    $("index"),
    h(
      "section",
      { class: "search" },
      h("h2", {}, h("label", { for: "search" }, "Szukaj kierunku")),
      h("input", {
        id: "search",
        type: "search",
        value: query,
        placeholder: "np. 240-ZBI albo informatyka 3",
        autocomplete: "off",
        oninput: (e) => {
          query = e.target.value;
          renderIndex();
        },
      }),
      renderResults(),
    ),
    renderPlans(),
    renderTree(),
    renderSubjects(),
  );
  if (hadFocus) {
    const input = $("search");
    input.focus();
    input.setSelectionRange(query.length, query.length);
  }
}

function planActions(code) {
  if (app.isActive(code)) return h("span", { class: "muted" }, "w widoku");
  return [
    h("button", { type: "button", class: "text-button", onclick: () => app.openPlan(code) }, "otwórz"),
    h("button", { type: "button", class: "text-button", onclick: () => app.addPlan(code) }, "dołącz"),
  ];
}

function renderResults() {
  if (!query.trim()) return null;
  const found = searchGroups(app.data, query);
  if (!found.length) return h("p", { class: "muted" }, "Nic nie pasuje. Wpisz kod grupy przedmiotów albo część nazwy kierunku.");
  return h(
    "ul",
    { class: "results" },
    found.map((g) =>
      h(
        "li",
        {},
        h("span", {}, g.name),
        h("span", { class: "code" }, g.code),
        h("span", { class: "actions" }, g.available ? planActions(g.code) : h("span", { class: "muted" }, "brak danych w makiecie")),
      ),
    ),
  );
}

function renderPlans() {
  const plans = app.activePlans();
  return h(
    "section",
    {},
    h("h2", {}, plans.length > 1 ? "Połączone plany" : "Plan"),
    h(
      "ul",
      { class: "plans" },
      plans.map((plan, i) =>
        h(
          "li",
          {},
          h("span", { class: plans.length > 1 ? `swatch ${tone(`plan-${i}`)}` : "", style: { width: "14px", height: "14px" }, "aria-hidden": "true" }),
          h("span", {}, plan.name),
          h("span", { class: "code" }, plan.code),
          h("span", { class: "hist" }, plan.history ? "Z historią zmian." : "Bez historii zmian."),
          plans.length > 1
            ? h("span", { class: "actions" }, h("button", { type: "button", class: "text-button", onclick: () => app.removePlan(plan.code) }, "odłącz"))
            : null,
        ),
      ),
    ),
  );
}

function node(key, summary, children) {
  return h(
    "details",
    { open: openNodes.has(key), ontoggle: (e) => (e.target.open ? openNodes.add(key) : openNodes.delete(key)) },
    h("summary", {}, summary),
    children,
  );
}

function openPath(code) {
  const match = code.match(/^(\d{3})-([A-Z]{2,4})-([12][SN])-(\d)R/);
  if (!match) return;
  openNodes.add(`${match[1]}-000`);
  openNodes.add(`${match[2]}-${match[3]}`);
  openNodes.add(`${match[2]}-${match[3]}-${match[4]}`);
}

function renderTree() {
  const tree = groupTree(app.data);
  const loaded = tree.filter((f) => f.loaded);
  const rest = tree.length - loaded.length;
  return h(
    "section",
    { class: "tree" },
    h("h2", {}, "Kierunki"),
    loaded.map((faculty) =>
      node(
        faculty.code,
        faculty.name,
        faculty.programmes.map((programme) =>
          node(
            programme.key,
            `${programme.name}, ${programme.level}`,
            programme.years.map((year) =>
              node(
                `${programme.key}-${year.year}`,
                `rok ${year.year}`,
                year.semesters.map((s) =>
                  h(
                    "div",
                    { class: "leaf" },
                    s.available
                      ? h("button", { type: "button", onclick: () => app.openPlan(s.code), title: s.code }, `semestr ${s.semester}, ${s.season}`)
                      : h("span", { class: "muted", title: s.code }, `semestr ${s.semester}, ${s.season}`),
                    s.available ? null : h("span", { class: "muted" }, "brak danych"),
                  ),
                ),
              ),
            ),
          ),
        ),
        faculty.other.length
          ? node(
              `${faculty.code}-inne`,
              "Inne",
              faculty.other.map((g) => h("div", { class: "leaf" }, h("span", { class: "muted", title: g.code }, g.name))),
            )
          : null,
      ),
    ),
    h("p", { class: "note" }, `Pozostałe wydziały (${rest}) pojawią się, gdy strona pobierze ich listy grup przedmiotów.`),
  );
}

function renderSubjects() {
  const subjects = app.subjects();
  const hidden = app.hiddenCount();
  return h(
    "section",
    {},
    h("h2", {}, "Przedmioty"),
    hidden ? h("p", {}, h("button", { type: "button", class: "text-button", onclick: app.showAll }, `Pokaż wszystko (ukryte: ${hidden})`)) : null,
    h(
      "ul",
      { class: "subjects" },
      subjects.map((s) =>
        h(
          "li",
          {},
          h(
            "div",
            { class: `subject-row${s.hidden ? " is-hidden" : ""}` },
            h("span", { class: "name" }, s.name, s.block ? h("span", { class: "muted" }, " (blok)") : null),
            h(
              "button",
              {
                type: "button",
                class: "toggle",
                "aria-pressed": String(!s.hidden),
                "aria-label": `${s.hidden ? "Pokaż" : "Ukryj"} przedmiot ${s.name}`,
                onclick: () => app.toggleSubject(s.code),
              },
              s.hidden ? "" : "✓",
            ),
          ),
          s.hidden
            ? null
            : h(
                "ul",
                { class: "types" },
                s.types.map((t) =>
                  h(
                    "li",
                    {},
                    h("span", { class: `type-name${t.hidden ? " is-hidden" : ""}` }, h("b", { class: `code ${tone(`type-${t.type}`)}` }, t.type), ` ${t.name}`),
                    h(
                      "button",
                      { type: "button", class: "link", onclick: () => app.toggleType(s.code, t.type) },
                      t.hidden ? "pokaż" : "ukryj",
                    ),
                    !t.hidden && t.groups.length > 1
                      ? h(
                          "span",
                          { class: "groups", role: "group", "aria-label": `Moja grupa: ${t.name}` },
                          t.groups.map((g) =>
                            h(
                              "button",
                              {
                                type: "button",
                                "aria-pressed": String(t.chosen === g),
                                title: t.chosen === g ? "Pokaż znowu wszystkie grupy" : `Zostaw tylko grupę ${g}`,
                                onclick: () => app.chooseGroup(s.code, t.type, g),
                              },
                              g,
                            ),
                          ),
                        )
                      : null,
                  ),
                ),
              ),
        ),
      ),
    ),
  );
}

// ---------- plan ----------

// Przedmioty blokowe są kreskowane, bo ich zajęcia to tylko zaślepki.
function fillClass(activity) {
  const key = app.colorKey(activity);
  return activity.block && key.startsWith("type-") ? "fill-hatch" : tone(key);
}

function renderLegend() {
  const merged = app.merged();
  const onlyBlocks = (type) => merged.filter((a) => a.type === type).every((a) => a.block);
  const items = app.legend().map((item) => {
    const cls = item.key.startsWith("type-") && onlyBlocks(item.key.slice(5)) ? "fill-hatch" : tone(item.key);
    return h("span", {}, h("i", { class: `swatch ${cls}`, "aria-hidden": "true" }), h("b", {}, item.short), ` ${item.label}`);
  });
  items.push(h("span", {}, h("i", { class: "swatch", style: { outline: "3px solid var(--accent)", outlineOffset: "-3px" }, "aria-hidden": "true" }), "kolizja"));
  if (app.historyPlans().length) items.push(h("span", {}, h("i", { class: "swatch", style: { width: "7px", height: "7px", background: "var(--ink)" }, "aria-hidden": "true" }), "zmiana od ostatniej migawki"));
  items.push(h("span", {}, "N/P: tygodnie nieparzyste/parzyste"));
  fill($("legend"), items);
}

function renderNotice() {
  const notice = $("notice");
  if (app.status === "ok") {
    notice.hidden = true;
    return;
  }
  const plan = app.activePlans()[0];
  notice.hidden = false;
  notice.className = `notice${app.status === "error" ? " is-strong" : ""}`;
  fill(
    notice,
    h("p", {}, statusMessage(app.status, app.data, plan)),
    app.status === "error" || app.status === "empty" ? h("p", {}, h("a", { href: plan.usosUrl }, "Ten plan w USOSweb")) : null,
  );
}

function renderSheet() {
  renderLegend();
  renderNotice();
  const unavailable = app.status === "error";
  document.querySelector(".grid-wrap").hidden = unavailable;
  $("agenda").hidden = unavailable;
  $("legend").hidden = unavailable;
  const view = app.state.mode === "week" ? app.calendarWeek() : app.typicalWeek();
  renderGrid(view);
  renderAgenda(view);
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

function renderGrid(view) {
  const { from, to } = app.hours();
  const span = to - from;
  const grid = $("grid");
  grid.style.setProperty("--days", view.days.length);
  const height = `calc(var(--hour) * ${span / 60})`;
  const cells = [h("div", { "aria-hidden": "true" })];
  for (const day of view.days) {
    cells.push(
      h(
        "div",
        { class: "day-head" },
        h("h3", {}, capitalize(day.name)),
        h("span", { class: "meta" }, dayMeta(day) || "\u00a0"),
        day.swapFrom !== null && day.swapFrom !== undefined
          ? h("span", { class: "swap" }, `zajęcia jak w ${dayAccusative(day.swapFrom)}`)
          : h("span", { class: "clash" }, day.conflicts ? `${day.conflicts} ${plural(day.conflicts, "kolizja", "kolizje", "kolizji")}` : "\u00a0"),
      ),
    );
  }
  const axis = h("div", { class: "axis", style: { height }, "aria-hidden": "true" });
  for (let m = from; m < to; m += 60) {
    axis.append(h("span", { style: { top: `${((m - from) / span) * 100}%` } }, `${m / 60}`));
  }
  cells.push(axis);
  for (const day of view.days) {
    const note = app.state.mode === "week" ? dayNote(day) : null;
    const column = h("div", { class: `column${note ? " is-off" : ""}`, style: { height } });
    if (note && !day.items.length) column.append(h("p", { class: "column__note" }, note));
    if (!note && !day.items.length) column.append(h("p", { class: "column__note" }, "brak zajęć"));
    for (const item of day.items) column.append(block(item, from, span));
    cells.push(column);
  }
  fill(grid, cells);
}

function block(item, from, span) {
  const a = item.activity;
  const top = ((minutes(a.start) - from) / span) * 100;
  const height = ((minutes(a.end) - minutes(a.start)) / span) * 100;
  const parity = a.recurrence === "odd" || a.recurrence === "even" ? ` · ${PARITY_SHORT[a.recurrence]}` : "";
  const spanInfo = app.state.mode === "typical" ? app.span(a) : null;
  const changed = a.members.some((m) => app.changesFor(m).length);
  // Nazwa dostaje tyle linii, ile zostaje po typie, prowadzącym i zakresie dat.
  let budget = Math.floor((((minutes(a.end) - minutes(a.start)) / 60) * HOUR_PX - 6) / LINE_PX) - 2;
  const showSpan = Boolean(spanInfo?.partial) && budget >= 1;
  if (showSpan) budget -= 1;
  const showWho = budget >= 1;
  if (showWho) budget -= 1;
  const nameLines = 1 + Math.max(0, Math.min(budget, 2));
  const classes = ["block", fillClass(a)];
  if (item.conflict) classes.push("is-clash");
  if (app.isFocused(a)) classes.push("is-selected");
  return h(
    "button",
    {
      type: "button",
      class: classes.join(" "),
      style: {
        top: `${top}%`,
        height: `${height}%`,
        left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
        width: `calc(${100 / item.lanes}% - 4px)`,
      },
      "aria-label": `${a.subjectName}, ${app.typeName(a.type)}, ${app.groupsLabel(a)}, ${a.start}–${a.end}${item.conflict ? ", kolizja" : ""}`,
      onclick: () => app.select(app.isFocused(a) ? null : a),
    },
    changed ? h("span", { class: "block__mark", "aria-hidden": "true" }) : null,
    h("span", { class: "block__name", style: { webkitLineClamp: String(nameLines) } }, a.subjectName),
    h("span", { class: "block__meta" }, h("b", { class: "code" }, a.type), ` ${app.groupsLabel(a)}${parity}${a.changedTime ? " · zmiana godzin" : ""}`),
    showWho
      ? h("span", { class: "block__who" }, a.block ? "blok, grupę wybierasz osobno" : a.members.length > 1 ? `${a.lecturers.length} ${plural(a.lecturers.length, "prowadzący", "prowadzących", "prowadzących")}` : app.lecturersLabel(a))
      : null,
    showSpan ? h("span", { class: "block__span" }, spanInfo.label) : null,
  );
}

function renderAgenda(view) {
  fill(
    $("agenda"),
    view.days.map((day) => {
      const note = app.state.mode === "week" ? dayNote(day) : null;
      return h(
        "section",
        {},
        h("h3", {}, capitalize(day.name), h("small", {}, [dayMeta(day), day.conflicts ? `${day.conflicts} kol.` : ""].filter(Boolean).join(" · "))),
        day.items.length
          ? h(
              "ol",
              {},
              [...day.items]
                .sort((x, y) => x.activity.start.localeCompare(y.activity.start))
                .map((item) =>
                  h(
                    "li",
                    {},
                    h(
                      "button",
                      { type: "button", onclick: () => app.select(item.activity) },
                      h("span", { class: "time" }, `${item.activity.start}–${item.activity.end}`),
                      h("strong", {}, h("i", { class: `swatch ${fillClass(item.activity)}`, style: { width: "10px", height: "10px", marginRight: "6px" }, "aria-hidden": "true" }), item.activity.subjectName),
                      h("span", {}, `${item.activity.type} ${app.groupsLabel(item.activity)} · ${app.lecturersLabel(item.activity)}`),
                      item.conflict ? h("span", { class: "clash" }, "kolizja") : h("span", {}),
                    ),
                  ),
                ),
            )
          : h("p", { class: "muted" }, note ?? "brak zajęć"),
      );
    }),
  );
}

// ---------- szczegóły ----------

function renderDetails() {
  const panel = $("details");
  const unit = app.focus;
  panel.hidden = !unit;
  document.querySelector(".layout").classList.toggle("has-details", Boolean(unit));
  if (!unit) return;
  const single = unit.members.length === 1;
  const spanInfo = app.span(unit);
  const clashes = app.conflictsOf(unit);
  const changes = unit.members.flatMap((m) => app.changesFor(m));
  fill(
    panel,
    h("button", { type: "button", class: "details__close", "aria-label": "Zamknij szczegóły", onclick: () => app.select(null) }, "×"),
    h("h2", {}, unit.subjectName),
    h("a", { href: subjectUrl(unit.subject) }, unit.subject),
    h(
      "dl",
      {},
      h("dt", {}, "Zajęcia"),
      h("dd", {}, `${app.typeName(unit.type)}, ${app.groupsLabel(unit)}`),
      h("dt", {}, "Termin"),
      h("dd", {}, `${capitalize(DAY_NAMES[unit.weekday])} ${unit.start}–${unit.end}${unit.date ? `, ${shortDate(unit.date)}` : ""}`, unit.changedTime ? h("div", {}, "W tym dniu zmieniona godzina.") : null),
      h("dt", {}, "Częstotliwość"),
      h("dd", {}, app.recurrenceLabel(unit)),
      single ? [h("dt", {}, "Prowadzący"), h("dd", {}, unit.block ? "blok, grupę wybierasz osobno" : lecturers(unit))] : null,
      single ? [h("dt", {}, "Miejsce"), h("dd", {}, app.place(unit) ?? "sala nieznana")] : null,
      spanInfo ? [h("dt", {}, "Spotkania"), h("dd", {}, `${spanInfo.countLabel}, ${shortDate(spanInfo.first)}–${shortDate(spanInfo.last)}`)] : null,
      app.activePlans().length > 1 ? [h("dt", {}, "Z planów"), h("dd", {}, app.sourcesLabel(unit))] : null,
    ),
    single ? null : h("h3", {}, "Grupy o tej porze"),
    single
      ? null
      : unit.members.map((m) =>
          h(
            "div",
            { class: "member" },
            h("b", {}, `Grupa ${m.group}${m.recurrence === "odd" ? ", tyg. nieparzyste" : m.recurrence === "even" ? ", tyg. parzyste" : ""}`),
            h("span", {}, m.block ? "blok" : lecturers(m)),
            h("span", {}, app.place(m) ?? "sala nieznana"),
            h("button", { type: "button", class: "text-button", onclick: () => app.chooseGroup(m.subject, m.type, m.group) }, "To moja grupa"),
          ),
        ),
    clashes.length
      ? [h("h3", {}, "Kolizje"), h("div", { class: "clash-list" }, clashes.map((c) => h("div", {}, `${c.subjectName}, ${c.type} ${app.groupsLabel(c)}, ${c.start}–${c.end}`)))]
      : null,
    changes.length
      ? [
          h("h3", {}, "Zmiany"),
          changes.map((c) => {
            const d = app.describeChange(c);
            return h("div", { class: "member" }, h("b", {}, `gr. ${c.group}: ${d.title}`), d.rows.map((r) => h("span", {}, r.before ? h("s", {}, r.before) : null, r.before && r.after ? " → " : null, r.after ?? "")));
          }),
        ]
      : null,
    h("h3", {}, "Daty spotkań"),
    h("div", { class: "dates" }, datesByMonth(unit)),
    h(
      "div",
      { class: "actions" },
      h("button", { type: "button", class: "text-button", onclick: () => { app.select(null); app.toggleSubject(unit.subject); } }, "Ukryj przedmiot"),
      h("button", { type: "button", class: "text-button", onclick: () => { app.select(null); app.toggleType(unit.subject, unit.type); } }, `Ukryj ${unit.type}`),
      h("a", { href: groupUrl(unit) }, "Grupa w USOSweb"),
    ),
  );
}

function lecturers(activity) {
  if (!activity.lecturers.length) return "prowadzący nieznany";
  return activity.lecturers.flatMap((p, i) => [i ? ", " : "", h("a", { href: personUrl(p.id) }, p.name)]);
}

const MONTH_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

function datesByMonth(unit) {
  const months = new Map();
  const dates = app.allDates(unit);
  for (const date of dates) {
    const key = date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(+date.slice(8, 10));
  }
  return [...months.entries()].map(([key, days]) => h("span", {}, `${MONTH_SHORT[+key.slice(5, 7) - 1]}: ${days.join(", ")}`));
}

// ---------- historia ----------

function renderHistory() {
  const section = $("history");
  const plans = app.historyPlans();
  if (!plans.length) {
    fill(
      section,
      h("h2", { id: "history-title" }, "Zmiany w planie"),
      h("p", { class: "history__lead" }, "Dla tego kierunku nie zbieramy historii. Historię mają kierunki z listy w konfiguracji strony, na razie 240-ZBI-1S-2R-Z."),
    );
    return;
  }
  const plan = plans[0];
  const { baseline, latest, changes: all } = historyOf(plan);
  const visible = new Set(app.visible().map((a) => `${a.unit}|${a.group}`));
  const changes = all.filter((c) => historyScope === "all" || visible.has(`${c.unit}|${c.group}`));
  fill(
    section,
    h("h2", { id: "history-title" }, "Zmiany w planie"),
    h(
      "p",
      { class: "history__lead" },
      `Porównanie ${plan.code} z migawką z ${stamp(baseline.at)} (${baseline.note}). Ostatnie sprawdzenie: ${stamp(latest.at)}. Kolejne co 6 godzin.`,
    ),
    segment("Pokaż", [["all", "wszystkie zmiany"], ["mine", "tylko widoczne zajęcia"]], historyScope, (value) => {
      historyScope = value;
      renderHistory();
    }),
    h(
      "div",
      { class: "history-wrap" },
      h(
        "table",
        {},
        h("thead", {}, h("tr", {}, ["Przedmiot", "Zajęcia", "Zmiana", "Było", "Jest"].map((t) => h("th", { scope: "col" }, t)))),
        h(
          "tbody",
          {},
          changes.map((c) => {
            const d = app.describeChange(c);
            return h(
              "tr",
              {},
              h("td", {}, c.subjectName),
              h("td", {}, `${c.type} gr. ${c.group}`),
              h("td", { class: "kind" }, d.title),
              h("td", {}, d.rows.map((r) => h("div", { class: "was" }, r.before ?? ""))),
              h("td", {}, d.rows.map((r) => h("div", { class: "is" }, r.after ?? "usunięte"))),
            );
          }),
        ),
      ),
    ),
    changes.length ? null : h("p", { class: "muted" }, "Żadna z widocznych zajęć się nie zmieniła."),
  );
}

// ---------- stopka ----------

function renderColophon() {
  const plan = app.activePlans()[0];
  fill(
    $("colophon"),
    h("p", {}, "Nieoficjalne narzędzie, niezwiązane z AGH. Dane pochodzą z publicznego USOS API i stron USOSweb dostępnych bez logowania."),
    h("p", {}, `Pobrano ${stamp(app.data.fetchedAt)}. `, h("a", { href: plan.usosUrl }, "Ten plan w USOSweb"), "."),
  );
}

// ---------- drobiazgi ----------

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
