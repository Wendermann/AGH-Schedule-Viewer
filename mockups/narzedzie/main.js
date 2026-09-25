import { applyTheme, copy, fill, h, keepFocus, readPreference, typing, writePreference } from "../wspolne/dom.js";
import { renderDemoBar } from "../wspolne/demo.js";
import {
  DAY_SHORT,
  STATUS_LABELS,
  compactRange,
  createApp,
  dayAccusative,
  groupTree,
  groupUrl,
  loadData,
  minutes,
  personUrl,
  plural,
  searchGroups,
  shortDate,
  stamp,
  statusMessage,
  subjectUrl,
} from "../wspolne/model.js";

const $ = (id) => document.getElementById(id);
const THEME_KEY = "grafik-motyw";
const THEMES = ["system", "light", "dark"];
const THEME_LABELS = { system: "systemowy", light: "jasny", dark: "ciemny" };
const HOUR_PX = 46;
const LINE_PX = 13;
const PARITY_SHORT = { odd: "N", even: "P" };

let app;
let query = "";
let resultIndex = 0;
let tab = "details";
let shareNote = "";
let theme = readPreference(THEME_KEY, "system");

boot();

async function boot() {
  applyTheme(theme);
  const loading = setTimeout(() => ($("loading").hidden = false), 300);
  try {
    const data = await loadData("dane/plany.json");
    app = createApp(data, { storageKey: "grafik-stan" });
  } catch (error) {
    clearTimeout(loading);
    $("loading").hidden = true;
    const banner = $("banner");
    banner.hidden = false;
    banner.className = "banner is-error";
    fill(banner, h("p", {}, `nie udało się wczytać danych makiety: ${error.message}`));
    return;
  }
  clearTimeout(loading);
  $("loading").hidden = true;
  shareNote = (await app.restore()) ?? "";
  app.onChange((reason) => keepFocus(() => render(reason)));
  document.addEventListener("keydown", onKey);
  renderDemoBar($("demo"), app, { current: "narzedzie.html" });
  render();
}

function render() {
  renderBar();
  renderSide();
  renderMain();
  renderInspector();
  renderStatus();
}

const view = () => (app.state.mode === "week" ? app.calendarWeek() : app.typicalWeek());

// Kolejność bloczków dla klawiszy j/k: dzień, potem godzina.
function orderedUnits() {
  return view()
    .days.flatMap((d) => d.items)
    .sort((a, b) => a.activity.weekday - b.activity.weekday || a.activity.start.localeCompare(b.activity.start) || a.lane - b.lane)
    .map((item) => item.activity);
}

function moveSelection(step) {
  const units = orderedUnits();
  if (!units.length) return;
  const at = units.findIndex((u) => app.isFocused(u));
  const next = at === -1 ? (step > 0 ? 0 : units.length - 1) : (at + step + units.length) % units.length;
  tab = "details";
  app.select(units[next]);
  document.querySelector(".ev.is-sel")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function onKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (typing(event)) {
    if (event.target.id === "search") onSearchKey(event);
    return;
  }
  const unit = app.focus;
  const actions = {
    "/": () => $("search").focus(),
    t: () => app.setMode("typical"),
    w: () => app.setMode("week"),
    1: () => app.state.mode === "typical" && app.setParity("all"),
    2: () => app.state.mode === "typical" && app.setParity("odd"),
    3: () => app.state.mode === "typical" && app.setParity("even"),
    ArrowLeft: () => app.state.mode === "week" && app.shiftWeek(-1),
    ArrowRight: () => app.state.mode === "week" && app.shiftWeek(1),
    j: () => moveSelection(1),
    k: () => moveSelection(-1),
    x: () => unit && (app.select(null), app.toggleSubject(unit.subject)),
    g: () => unit && unit.members.length === 1 && app.chooseGroup(unit.subject, unit.type, unit.group),
    u: () => app.showAll(),
    d: () => showTab(tab === "log" ? "details" : "log"),
    s: () => share(),
    "?": () => showTab("keys"),
    Escape: () => (app.focus ? app.select(null) : showTab("details")),
  };
  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  action();
}

function showTab(next) {
  tab = next;
  keepFocus(renderInspector);
}

// ---------- górny pasek ----------

function renderBar() {
  const plans = app.activePlans();
  const week = app.state.mode === "week";
  const btn = (label, key, pressed, onclick, extra = {}) =>
    h("button", { type: "button", class: "btn", "aria-pressed": String(pressed), onclick, ...extra }, label, key ? h("kbd", {}, key) : null);
  fill(
    $("bar"),
    h("p", { class: "logo" }, "grafik", h("span", {}, " / planów AGH")),
    h("span", { class: "sep", "aria-hidden": "true" }),
    h(
      "div",
      { class: "chips", "aria-label": "Plany w widoku" },
      plans.map((p, i) =>
        h(
          "span",
          { class: `chip c-${plans.length > 1 ? `plan-${i}` : "none"}` },
          plans.length > 1 ? h("i", { class: "key", "aria-hidden": "true" }) : null,
          p.code,
          plans.length > 1 ? h("button", { type: "button", "aria-label": `Odłącz plan ${p.code}`, onclick: () => app.removePlan(p.code) }, "×") : null,
        ),
      ),
    ),
    renderSearch(),
    h("span", { class: "sep", "aria-hidden": "true" }),
    h(
      "span",
      { class: "group", role: "group", "aria-label": "Widok" },
      btn("typowy", "t", !week, () => app.setMode("typical")),
      btn("kalendarz", "w", week, () => app.setMode("week")),
    ),
    week
      ? h(
          "span",
          { class: "week" },
          h("button", { type: "button", class: "btn", "aria-label": "Poprzedni tydzień", onclick: () => app.shiftWeek(-1) }, "←"),
          h("span", { "aria-live": "polite" }, app.weekLabel()),
          h("button", { type: "button", class: "btn", "aria-label": "Następny tydzień", onclick: () => app.shiftWeek(1) }, "→"),
        )
      : h(
          "span",
          { class: "group", role: "group", "aria-label": "Parzystość tygodni" },
          btn("wszystkie", "1", app.state.parity === "all", () => app.setParity("all")),
          btn("N", "2", app.state.parity === "odd", () => app.setParity("odd"), { "aria-label": "tygodnie nieparzyste" }),
          btn("P", "3", app.state.parity === "even", () => app.setParity("even"), { "aria-label": "tygodnie parzyste" }),
        ),
    h(
      "span",
      { class: "bar__end" },
      shareNote ? h("span", { class: "note", role: "status" }, shareNote) : null,
      btn("udostępnij", "s", false, share),
      h(
        "button",
        {
          type: "button",
          class: "btn",
          onclick: () => {
            theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
            writePreference(THEME_KEY, theme);
            applyTheme(theme);
            keepFocus(renderBar);
          },
        },
        `motyw: ${THEME_LABELS[theme]}`,
      ),
    ),
  );
}

function renderSearch() {
  const found = query.trim() ? searchGroups(app.data, query) : [];
  resultIndex = Math.min(resultIndex, Math.max(found.length - 1, 0));
  return h(
    "div",
    { class: "search" },
    h("label", { class: "visually-hidden", for: "search", style: { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" } }, "Szukaj grupy przedmiotów"),
    h("input", {
      id: "search",
      type: "search",
      value: query,
      placeholder: "szukaj kierunku",
      autocomplete: "off",
      role: "combobox",
      "aria-expanded": String(Boolean(query.trim())),
      "aria-controls": "results",
      oninput: (e) => {
        query = e.target.value;
        resultIndex = 0;
        keepFocus(renderBar);
      },
    }),
    query.trim()
      ? h(
          "ul",
          { class: "results", id: "results", role: "listbox" },
          found.length
            ? found.map((g, i) =>
                h(
                  "li",
                  { role: "option", "aria-selected": String(i === resultIndex) },
                  h("span", {}, g.name),
                  h("span", { class: "code" }, g.code),
                  h(
                    "span",
                    { class: "act" },
                    !g.available
                      ? h("span", { class: "muted" }, "brak danych w makiecie")
                      : app.isActive(g.code)
                        ? h("span", { class: "muted" }, "w widoku")
                        : [
                            h("button", { type: "button", class: "btn", onclick: () => pick(g.code, false) }, "otwórz"),
                            h("button", { type: "button", class: "btn", onclick: () => pick(g.code, true) }, "dołącz"),
                          ],
                  ),
                ),
              )
            : h("li", { class: "empty" }, "brak wyników. Wpisz kod, np. 240-INF, albo część nazwy."),
        )
      : null,
  );
}

function onSearchKey(event) {
  const found = searchGroups(app.data, query).filter((g) => g.available && !app.isActive(g.code));
  if (event.key === "Escape") {
    query = "";
    event.target.blur();
    renderBar();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const all = searchGroups(app.data, query);
    resultIndex = (resultIndex + (event.key === "ArrowDown" ? 1 : -1) + all.length) % Math.max(all.length, 1);
    keepFocus(renderBar);
  } else if (event.key === "Enter") {
    const chosen = searchGroups(app.data, query)[resultIndex];
    if (chosen?.available && !app.isActive(chosen.code)) pick(chosen.code, event.shiftKey);
    else if (!found.length) shareNote = "Tej grupy nie ma w danych makiety.";
  }
}

function pick(code, merge) {
  query = "";
  merge ? app.addPlan(code) : app.openPlan(code);
}

async function share() {
  const url = await app.shareUrl();
  shareNote = (await copy(url)) ? "link skopiowany" : `link: ${url}`;
  keepFocus(renderBar);
}

// ---------- panel boczny ----------

function renderSide() {
  const subjects = app.subjects();
  const hidden = app.hiddenCount();
  fill(
    $("side"),
    h("p", { class: "pane-title" }, h("span", {}, "przedmioty"), hidden ? h("button", { type: "button", class: "btn", onclick: app.showAll }, `pokaż wszystko `, h("kbd", {}, "u")) : null),
    h(
      "ul",
      { class: "subjects" },
      subjects.map((s) =>
        h(
          "li",
          {},
          h(
            "label",
            {},
            h("input", { type: "checkbox", checked: !s.hidden, onchange: () => app.toggleSubject(s.code) }),
            h("span", { class: s.hidden ? "off" : "" }, s.name, s.block ? " (blok)" : "", h("span", { class: "code" }, s.code)),
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
                    h(
                      "label",
                      { title: t.name },
                      h("input", { type: "checkbox", checked: !t.hidden, onchange: () => app.toggleType(s.code, t.type) }),
                      h("span", { class: `tcode c-${t.type}`, style: { color: "var(--c)" } }, t.type),
                    ),
                    !t.hidden && t.groups.length > 1
                      ? h(
                          "span",
                          { class: "radios", role: "radiogroup", "aria-label": `Moja grupa: ${s.name}, ${t.name}` },
                          [null, ...t.groups].map((g) =>
                            h(
                              "label",
                              {},
                              h("input", {
                                type: "radio",
                                name: `g-${s.code}-${t.type}`,
                                checked: t.chosen === g,
                                onchange: () => app.chooseGroup(s.code, t.type, g),
                              }),
                              g === null ? "wsz." : g,
                            ),
                          ),
                        )
                      : h("span", { class: "radios muted" }, t.hidden ? "ukryte" : `gr. ${t.groups.join(", ")}`),
                  ),
                ),
              ),
        ),
      ),
    ),
    renderTree(),
  );
}

function renderTree() {
  const tree = groupTree(app.data).filter((f) => f.loaded);
  return [
    h("p", { class: "pane-title" }, h("span", {}, "kierunki")),
    h(
      "div",
      { class: "tree" },
      tree.map((faculty) =>
        h(
          "details",
          { open: true, style: { paddingLeft: 0 } },
          h("summary", {}, faculty.name),
          faculty.programmes.map((p) =>
            h(
              "details",
              { open: p.years.some((y) => y.semesters.some((s) => app.isActive(s.code))) },
              h("summary", {}, `${p.name} `, h("span", { class: "muted" }, p.level)),
              p.years.flatMap((y) =>
                y.semesters.map((s) =>
                  h(
                    "div",
                    { class: "leaf" },
                    h("span", { class: "mono muted" }, `r${y.year}`),
                    s.available
                      ? h("button", { type: "button", onclick: () => app.openPlan(s.code) }, `semestr ${s.semester}`)
                      : h("span", { class: "muted" }, `semestr ${s.semester}`),
                    app.isActive(s.code) ? h("span", { class: "mono" }, "●") : null,
                  ),
                ),
              ),
            ),
          ),
          faculty.other.length
            ? h("details", {}, h("summary", {}, "Inne"), faculty.other.map((g) => h("div", { class: "leaf" }, h("span", { class: "mono muted" }, g.code))))
            : null,
        ),
      ),
      h("p", { class: "muted", style: { fontSize: "12px" } }, "Pozostałe 17 wydziałów pojawi się po pobraniu indeksu."),
    ),
  ];
}

// ---------- siatka ----------

function colorClass(unit) {
  const key = app.colorKey(unit);
  return key.startsWith("type-") ? `c-${key.slice(5)}` : `c-${key}`;
}

function renderMain() {
  const banner = $("banner");
  const problem = app.status !== "ok";
  banner.hidden = !problem;
  banner.className = `banner${app.status === "error" ? " is-error" : ""}`;
  if (problem) {
    const plan = app.activePlans()[0];
    fill(
      banner,
      h("p", {}, statusMessage(app.status, app.data, plan)),
      app.status === "error" || app.status === "empty" ? h("p", {}, h("a", { href: plan.usosUrl }, "plan w USOSweb")) : null,
    );
  }
  $("grid-wrap").hidden = app.status === "error";
  $("agenda").hidden = app.status === "error";
  const v = view();
  renderGrid(v);
  renderAgenda(v);
}

function dayNote(day) {
  if (app.state.mode !== "week") return null;
  if (day.outside) return "poza semestrem";
  if (day.dayOff) return "dzień wolny";
  if (day.beforeClasses) return "przed zajęciami";
  if (day.afterClasses) return "sesja";
  return null;
}

function renderGrid(v) {
  const { from, to } = app.hours();
  const span = to - from;
  const grid = $("grid");
  grid.style.setProperty("--days", v.days.length);
  const height = `${(span / 60) * HOUR_PX}px`;
  const legend = h(
    "div",
    { class: "legend", style: { gridColumn: "1 / -1", padding: "6px 8px 0" } },
    app.legend().map((item) => h("span", { class: `c-${item.key.replace("type-", "")}` }, h("i", { class: "key", "aria-hidden": "true" }), h("span", { class: "mono" }, item.short), item.label)),
    h("span", {}, h("span", { class: "mono", style: { color: "var(--clash)" } }, "kolizja"), "czerwona ramka"),
    app.historyPlans().length ? h("span", {}, h("span", { class: "mono" }, "Δ"), "zmiana od poprzedniej migawki") : null,
  );
  const cells = [legend, h("div", { class: "dh-corner" })];
  for (const day of v.days) {
    const flag =
      day.swapFrom !== null && day.swapFrom !== undefined
        ? h("span", { class: "swap" }, `jak ${DAY_SHORT[day.swapFrom]}`)
        : day.conflicts
          ? h("span", { class: "clash" }, `${day.conflicts} kol.`)
          : null;
    cells.push(
      h(
        "div",
        { class: "dh", title: day.swapFrom !== null && day.swapFrom !== undefined ? `Tego dnia zajęcia jak w ${dayAccusative(day.swapFrom)}` : null },
        h("b", {}, DAY_SHORT[day.weekday]),
        h("span", { class: "meta" }, [day.date ? shortDate(day.date) : "", day.weekNo ? `t${day.weekNo}${PARITY_SHORT[day.parity]}` : ""].filter(Boolean).join(" ")),
        flag,
      ),
    );
  }
  const axis = h("div", { class: "axis", style: { height }, "aria-hidden": "true" });
  for (let m = from; m < to; m += 60) {
    const label = h("span", { style: { top: `${((m - from) / 60) * HOUR_PX}px` } }, `${String(m / 60).padStart(2, "0")}:00`);
    if (m === from) label.style.transform = "none";
    axis.append(label);
  }
  cells.push(axis);
  for (const day of v.days) {
    const note = dayNote(day);
    const col = h("div", { class: `col${note ? " is-off" : ""}`, style: { height } });
    if (!day.items.length) col.append(h("span", { class: "empty" }, note ?? "brak zajęć"));
    for (const item of day.items) col.append(event(item, from));
    cells.push(col);
  }
  fill(grid, cells);
}

function event(item, from) {
  const u = item.activity;
  const px = ((minutes(u.end) - minutes(u.start)) / 60) * HOUR_PX;
  const lines = Math.floor((px - 4) / LINE_PX);
  const partial = app.state.mode === "typical" ? app.span(u) : null;
  const extra = partial?.partial ? 1 : 0;
  const nameLines = Math.max(1, lines - 2 - extra);
  const parity = PARITY_SHORT[u.recurrence] ?? (u.recurrence === "mixed" ? "N/P" : "");
  const changed = u.members.some((m) => app.changesFor(m).length);
  const classes = ["ev", colorClass(u)];
  if (u.block) classes.push("is-block");
  if (item.conflict) classes.push("is-clash");
  if (app.isFocused(u)) classes.push("is-sel");
  return h(
    "button",
    {
      type: "button",
      class: classes.join(" "),
      style: {
        top: `${((minutes(u.start) - from) / 60) * HOUR_PX}px`,
        height: `${px}px`,
        left: `calc(${(item.lane / item.lanes) * 100}% + 1px)`,
        width: `calc(${100 / item.lanes}% - 2px)`,
      },
      "aria-label": `${u.start}–${u.end} ${u.subjectName}, ${app.typeName(u.type)}, ${app.groupsLabel(u)}${item.conflict ? ", kolizja" : ""}`,
      onclick: () => {
        tab = "details";
        app.select(app.isFocused(u) ? null : u);
      },
    },
    changed ? h("span", { class: "ev__delta", "aria-hidden": "true" }, "Δ") : null,
    h("span", { class: "ev__top" }, h("span", {}, u.start), h("b", {}, u.type), app.groupsLabel(u), parity ? h("span", {}, parity) : null),
    h("span", { class: "ev__name", style: { webkitLineClamp: String(nameLines) } }, u.subjectName),
    lines - nameLines >= 2 ? h("span", { class: "ev__sub" }, u.block ? "blok" : u.members.length > 1 ? `${u.lecturers.length} ${plural(u.lecturers.length, "prowadzący", "prowadzących", "prowadzących")}` : app.lecturersLabel(u)) : null,
    extra ? h("span", { class: "ev__sub mono" }, partial.label) : null,
    u.changedTime ? h("span", { class: "ev__sub" }, "zmieniona godzina") : null,
  );
}

function renderAgenda(v) {
  fill(
    $("agenda"),
    v.days.map((day) =>
      h(
        "section",
        {},
        h("h3", {}, h("span", {}, `${DAY_SHORT[day.weekday]} ${day.date ? shortDate(day.date) : ""}`), h("span", {}, day.conflicts ? `${day.conflicts} kol.` : "")),
        day.items.length
          ? h(
              "ol",
              {},
              [...day.items]
                .sort((a, b) => a.activity.start.localeCompare(b.activity.start))
                .map((item) =>
                  h(
                    "li",
                    {},
                    h(
                      "button",
                      { type: "button", onclick: () => app.select(item.activity) },
                      h("span", { class: "t" }, `${item.activity.start}–${item.activity.end}`),
                      h("span", {}, h("b", {}, item.activity.subjectName), ` ${item.activity.type} ${app.groupsLabel(item.activity)}`, item.conflict ? h("span", { style: { color: "var(--clash)" } }, " kolizja") : null),
                    ),
                  ),
                ),
            )
          : h("p", { class: "empty" }, dayNote(day) ?? "brak zajęć"),
      ),
    ),
  );
}

// ---------- inspektor ----------

function renderInspector() {
  const changes = app.historyPlans().flatMap((p) => p.history.changes);
  const tabs = [
    ["details", "szczegóły"],
    ["log", `dziennik${changes.length ? ` (${changes.length})` : ""}`],
    ["keys", "skróty"],
  ];
  fill(
    $("inspector"),
    h(
      "div",
      { class: "tabs", role: "tablist" },
      tabs.map(([id, label]) => h("button", { type: "button", role: "tab", "aria-selected": String(tab === id), onclick: () => showTab(id) }, label)),
    ),
    h("div", { class: "tab", role: "tabpanel" }, tab === "log" ? renderLog() : tab === "keys" ? renderKeys() : renderDetails()),
  );
}

function renderDetails() {
  const u = app.focus;
  if (!u) {
    return h(
      "p",
      { class: "help" },
      "Wybierz zajęcia na planie albo przejdź między nimi klawiszami ",
      h("kbd", {}, "j"),
      " i ",
      h("kbd", {}, "k"),
      ". Tutaj pojawią się prowadzący, sala, daty spotkań i zmiany.",
    );
  }
  const single = u.members.length === 1;
  const dates = app.allDates(u);
  const spanInfo = app.span(u);
  const clashes = app.conflictsOf(u);
  const changes = u.members.flatMap((m) => app.changesFor(m));
  const moved = u.members.flatMap((m) => (m.origin ?? m).changed ?? []);
  return [
    h("h2", {}, u.subjectName),
    h("a", { class: "mono", href: subjectUrl(u.subject) }, u.subject),
    h(
      "dl",
      { class: "kv" },
      h("dt", {}, "zajęcia"),
      h("dd", {}, `${app.typeName(u.type)}, ${app.groupsLabel(u)}`),
      h("dt", {}, "termin"),
      h("dd", { class: "mono" }, `${DAY_SHORT[u.weekday]} ${u.start}–${u.end}${u.date ? ` · ${shortDate(u.date)}` : ""}`),
      h("dt", {}, "częstotliwość"),
      h("dd", {}, app.recurrenceLabel(u)),
      single ? [h("dt", {}, "prowadzący"), h("dd", {}, u.block ? "blok, grupę wybierasz osobno" : people(u))] : null,
      single ? [h("dt", {}, "miejsce"), h("dd", {}, app.place(u) ?? "nieznane")] : null,
      spanInfo ? [h("dt", {}, "spotkania"), h("dd", { class: "mono" }, `${spanInfo.count} · ${shortDate(spanInfo.first)}–${shortDate(spanInfo.last)}`)] : null,
      app.activePlans().length > 1 ? [h("dt", {}, "plany"), h("dd", { class: "mono" }, app.sourcesLabel(u))] : null,
    ),
    single
      ? null
      : [
          h("h3", {}, `grupy o tej porze: ${compactRange(u.members.map((m) => m.group))}`),
          h(
            "div",
            { class: "members" },
            u.members.map((m) =>
              h(
                "div",
                { class: "member" },
                h("span", { class: "mono" }, `gr.${m.group}${PARITY_SHORT[m.recurrence] ? ` ${PARITY_SHORT[m.recurrence]}` : ""}`),
                h("span", {}, m.block ? "blok" : people(m), ", ", app.place(m) ?? "sala nieznana"),
                h("span", {}, h("button", { type: "button", class: "btn", onclick: () => app.chooseGroup(m.subject, m.type, m.group) }, "moja grupa")),
              ),
            ),
          ),
        ],
    clashes.length ? [h("h3", {}, "kolizje"), h("div", { class: "clashes" }, clashes.map((c) => h("span", {}, `${c.start}–${c.end} ${c.subjectName} ${c.type} ${app.groupsLabel(c)}`)))] : null,
    changes.length
      ? [
          h("h3", {}, "zmiany"),
          h(
            "div",
            { class: "log" },
            changes.map((c) => {
              const d = app.describeChange(c);
              return h("div", { class: "entry" }, h("div", {}, `gr.${c.group} ${d.title}`), d.rows.map((r) => [r.before ? h("div", { class: "minus" }, `- ${r.before}`) : null, r.after ? h("div", { class: "plus" }, `+ ${r.after}`) : null]));
            }),
          ),
        ]
      : null,
    h("h3", {}, `daty (${dates.length})`),
    h("div", { class: "dates" }, datesLines(dates), moved.map((m) => h("span", { class: "moved" }, `${shortDate(m.date)}: ${m.start}–${m.end} (zmieniona godzina)`))),
    h(
      "div",
      { class: "actions" },
      h("button", { type: "button", class: "btn", onclick: () => (app.select(null), app.toggleSubject(u.subject)) }, "ukryj przedmiot", h("kbd", {}, "x")),
      single && u.members[0] ? h("button", { type: "button", class: "btn", onclick: () => app.chooseGroup(u.subject, u.type, u.group) }, "moja grupa", h("kbd", {}, "g")) : null,
      h("a", { class: "btn", href: groupUrl(u) }, "USOSweb"),
    ),
  ];
}

function people(activity) {
  if (!activity.lecturers.length) return "nieznany";
  return activity.lecturers.flatMap((p, i) => [i ? ", " : "", h("a", { href: personUrl(p.id) }, p.name)]);
}

function datesLines(dates) {
  const byMonth = new Map();
  for (const d of dates) {
    const key = d.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d.slice(8, 10));
  }
  return [...byMonth.entries()].map(([key, days]) => h("span", {}, `${key}  ${days.join(" ")}`));
}

function renderLog() {
  const plans = app.historyPlans();
  if (!plans.length) {
    return h("p", { class: "help" }, "Ten kierunek nie ma historii zmian. Historię zbieramy dla kierunków z listy w konfiguracji strony (na razie 240-ZBI-1S-2R-Z).");
  }
  return plans.map((plan) => {
    const [baseline, latest] = plan.history.checks;
    return h(
      "div",
      { class: "log" },
      h("div", { class: "check" }, `# ${plan.code}`),
      h("div", { class: "check" }, `${stamp(latest.at)}  sprawdzenie, ${plan.history.changes.length} ${plural(plan.history.changes.length, "zmiana", "zmiany", "zmian")}`),
      plan.history.changes.map((c) => {
        const d = app.describeChange(c);
        const mark = { added: "A", removed: "D", modified: "M" }[c.kind];
        const target = orderedUnits().find((u) => u.members.some((m) => m.unit === c.unit && m.group === c.group));
        return h(
          "div",
          { class: "entry" },
          h(
            "button",
            {
              type: "button",
              disabled: !target,
              title: target ? "Pokaż te zajęcia na planie" : "Tych zajęć nie ma w bieżącym widoku",
              onclick: () => {
                tab = "details";
                app.select(target);
              },
            },
            h("span", { class: "k" }, mark),
            `${c.type} gr.${c.group} `,
            h("span", { class: "name" }, c.subjectName),
          ),
          d.rows.map((r) => [r.before ? h("div", { class: "minus" }, `  - ${r.before}`) : null, r.after ? h("div", { class: "plus" }, `  + ${r.after}`) : null]),
        );
      }),
      h("div", { class: "check" }, `${stamp(baseline.at)}  ${baseline.note}`),
      h("p", { class: "help" }, "Kolejne sprawdzenia co 6 godzin. A dodane, M zmienione, D usunięte zajęcia."),
    );
  });
}

function renderKeys() {
  const rows = [
    ["/", "szukaj grupy przedmiotów"],
    ["Enter", "otwórz wynik (Shift+Enter: dołącz do planu)"],
    ["t / w", "tydzień typowy / kalendarzowy"],
    ["1 2 3", "wszystkie / nieparzyste / parzyste"],
    ["← →", "poprzedni / następny tydzień"],
    ["j / k", "następne / poprzednie zajęcia"],
    ["x", "ukryj przedmiot zaznaczonych zajęć"],
    ["g", "zostaw tylko tę grupę"],
    ["u", "pokaż wszystko"],
    ["d", "dziennik zmian"],
    ["s", "skopiuj link do widoku"],
    ["Esc", "odznacz"],
  ];
  return h("div", { class: "shortcuts" }, rows.map(([key, text]) => [h("kbd", {}, key), h("span", {}, text)]));
}

// ---------- pasek stanu ----------

function renderStatus() {
  const v = view();
  const clashes = v.days.filter((d) => d.conflicts).map((d) => `${DAY_SHORT[d.weekday]} ${d.conflicts}`);
  const mode = app.state.mode === "week" ? `tydz. ${app.weekLabel()}` : `typowy, ${{ all: "wszystkie", odd: "nieparzyste", even: "parzyste" }[app.state.parity]}`;
  fill(
    $("statusbar"),
    h("span", {}, app.data.term.id),
    h("span", {}, mode),
    h("span", {}, `${v.total} ${plural(v.total, "bloczek", "bloczki", "bloczków")}`),
    clashes.length ? h("span", { class: "clash" }, `kolizje: ${clashes.join(", ")}`) : h("span", {}, "bez kolizji"),
    app.hiddenCount() ? h("span", {}, `ukryte: ${app.hiddenCount()}`) : null,
    app.status === "ok" ? h("span", {}, `dane ${stamp(app.data.fetchedAt)}`) : h("span", { class: "warn" }, STATUS_LABELS[app.status]),
    h("span", {}, h("kbd", {}, "?"), " skróty"),
    h("span", {}, "nieoficjalne, dane z USOS API i USOSweb"),
  );
}
