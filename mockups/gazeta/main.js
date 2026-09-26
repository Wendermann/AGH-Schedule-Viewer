import { applyTheme, copy, fill, h, keepFocus, readPreference, typing, writePreference } from "../wspolne/dom.js";
import { renderDemoBar } from "../wspolne/demo.js";
import {
  DAY_NAMES,
  addDays,
  createApp,
  dayAccusative,
  diffDays,
  fromDay,
  groupTree,
  groupUrl,
  historyOf,
  loadData,
  longDate,
  mondayOf,
  personUrl,
  plural,
  searchGroups,
  shortDate,
  stamp,
  statusMessage,
  subjectUrl,
} from "../wspolne/model.js";

const $ = (id) => document.getElementById(id);
const THEME_KEY = "tygodnik-motyw";
const MOTION_KEY = "tygodnik-ruch";
const MOTIONS = {
  A: ["A. skład przy czytelniku", "Zmień parzystość, dołącz plan albo ukryj przedmiot: notki przepływają na nowe miejsca."],
  B: ["B. przewracanie stron", "Przełącz tydzień albo wydanie: stara strona odwraca się jak kartka."],
  C: ["C. ruch przy przewijaniu", "Przewiń stronę: winieta zwija się w wąski pasek."],
  D: ["D. mikrointerakcje", "Ukryj przedmiot w dziale: notki zostają przekreślone i się zwijają."],
  off: ["bez ruchu", "Wszystkie zmiany bez animacji."],
};
const TYPE_WORDS = { W: "wykład", CWA: "ćwiczenia", CWL: "laboratorium", CWP: "projekt", LEKT: "lektorat", WF: "wf" };
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let app;
let query = "";
let shareNote = "";
let theme = readPreference(THEME_KEY, "system");
let motion = readPreference(MOTION_KEY, "A");
let shownWeek = null;
let shownMode = null;

const moving = (variant) => motion === variant && !reduced.matches;

boot();

async function boot() {
  applyTheme(theme);
  applyMotion();
  const loading = setTimeout(() => ($("loading").hidden = false), 300);
  try {
    app = createApp(await loadData("dane/plany.json"), { storageKey: "tygodnik-stan" });
  } catch (error) {
    clearTimeout(loading);
    $("loading").hidden = true;
    showBulletin("Wydanie się nie ukazało", `Nie udało się wczytać danych makiety: ${error.message}`);
    return;
  }
  clearTimeout(loading);
  $("loading").hidden = true;
  shareNote = (await app.restore()) ?? "";
  shownWeek = app.state.week;
  shownMode = app.state.mode;
  app.onChange(update);
  document.addEventListener("keydown", onKey);
  addEventListener("scroll", onScroll, { passive: true });
  renderDemo();
  render();
}

function onKey(event) {
  if (typing(event) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "Escape" && app.focus) app.select(null);
  if (app.state.mode !== "week") return;
  if (event.key === "ArrowLeft") app.shiftWeek(-1);
  if (event.key === "ArrowRight") app.shiftWeek(1);
}

// ---------- ruch ----------

function applyMotion() {
  document.body.classList.remove("motion-A", "motion-B", "motion-C", "motion-D", "motion-off");
  document.body.classList.add(`motion-${reduced.matches ? "off" : motion}`);
  document.documentElement.style.setProperty("--collapse", "0");
}

function onScroll() {
  if (!moving("C")) return;
  const progress = Math.min(Math.max(scrollY / 180, 0), 1);
  document.documentElement.style.setProperty("--collapse", progress.toFixed(3));
}

function positions() {
  const map = new Map();
  for (const el of document.querySelectorAll("[data-key]")) map.set(el.dataset.key, el.getBoundingClientRect());
  return map;
}

// Wariant A: każda notka płynie z dawnego miejsca na nowe (technika FLIP).
function reflow(before) {
  for (const el of document.querySelectorAll("[data-key]")) {
    const old = before.get(el.dataset.key);
    if (!old) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
      continue;
    }
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
}

// Wariant B: kopia starej strony odwraca się nad nową jak kartka.
function turnPage(ghost, forward) {
  const wrap = document.querySelector(".page-wrap");
  ghost.style.transformOrigin = forward ? "left center" : "right center";
  wrap.append(ghost);
  const turn = ghost.animate(
    [
      { transform: "rotateY(0deg)", filter: "brightness(1)" },
      { transform: `rotateY(${forward ? -105 : 105}deg)`, filter: "brightness(0.8)" },
    ],
    { duration: 650, easing: "cubic-bezier(.45,.05,.3,1)" },
  );
  turn.onfinish = () => ghost.remove();
  turn.oncancel = () => ghost.remove();
}

// Wariant D: ukrywane notki są przekreślane i zwijają się, zanim znikną z planu.
async function strikeOut(selector, apply) {
  const stories = [...document.querySelectorAll(selector)];
  if (!moving("D") || !stories.length) {
    apply();
    return;
  }
  const runs = stories.map((el) => {
    el.classList.add("is-leaving");
    return el.animate(
      [
        { height: `${el.offsetHeight}px`, opacity: 1 },
        { height: `${el.offsetHeight}px`, opacity: 1, offset: 0.45 },
        { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" },
      ],
      { duration: 420, easing: "ease-in", fill: "forwards" },
    ).finished;
  });
  await Promise.allSettled(runs);
  apply();
}

function hideSubject(code) {
  const hidden = app.state.selection.hiddenSubjects.has(code);
  if (hidden) app.toggleSubject(code);
  else strikeOut(`.story[data-subject="${CSS.escape(code)}"]`, () => app.toggleSubject(code));
}

function hideType(subject, type) {
  const key = `${subject}|${type}`;
  if (app.state.selection.hiddenTypes.has(key)) app.toggleType(subject, type);
  else strikeOut(`.story[data-subject="${CSS.escape(subject)}"][data-type="${CSS.escape(type)}"]`, () => app.toggleType(subject, type));
}

function update(reason) {
  const before = moving("A") || moving("D") ? positions() : null;
  const turning = moving("B") && (app.state.week !== shownWeek || app.state.mode !== shownMode);
  const forward = app.state.mode !== shownMode ? app.state.mode === "week" : app.state.week > shownWeek;
  let ghost = null;
  if (turning) {
    ghost = $("page").cloneNode(true);
    ghost.removeAttribute("id");
    ghost.classList.add("ghost");
    for (const el of ghost.querySelectorAll("[id]")) el.removeAttribute("id");
  }
  shownWeek = app.state.week;
  shownMode = app.state.mode;
  keepFocus(render);
  if (ghost) turnPage(ghost, forward);
  else if (before && moving("A")) reflow(before);
  else if (before && moving("D") && reason !== "focus") {
    for (const el of document.querySelectorAll(".story[data-key]")) {
      if (!before.has(el.dataset.key)) el.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
    }
  }
}

// ---------- całość ----------

function render() {
  renderStrip();
  renderDateline();
  renderSections();
  renderBulletin();
  renderPage();
  renderContents();
  renderNews();
  renderImprint();
}

function renderDemo() {
  const select = h(
    "select",
    {
      id: "demo-motion",
      onchange: (e) => {
        motion = e.target.value;
        writePreference(MOTION_KEY, motion);
        applyMotion();
        renderDemo();
      },
    },
    Object.entries(MOTIONS).map(([key, [label]]) => h("option", { value: key, selected: key === motion }, label)),
  );
  renderDemoBar($("demo"), app, {
    current: "gazeta.html",
    extra: [
      h("label", {}, "Ruch ", select),
      h("span", {}, reduced.matches ? "System prosi o ograniczenie ruchu, więc animacje są wyłączone." : MOTIONS[motion][1]),
    ],
  });
}

function renderStrip() {
  const themes = [["system", "jak w systemie"], ["light", "dzienne"], ["dark", "nocne"]];
  fill(
    $("strip"),
    h("span", {}, "Nieoficjalny przegląd planów zajęć AGH · dane z USOS API i USOSweb"),
    h(
      "span",
      { class: "strip__end" },
      h(
        "span",
        { role: "group", "aria-label": "Motyw" },
        "Wydanie: ",
        themes.map(([value, label], i) => [
          i ? " · " : "",
          h(
            "button",
            {
              type: "button",
              class: "link-button",
              "aria-pressed": String(theme === value),
              onclick: () => {
                theme = value;
                writePreference(THEME_KEY, value);
                applyTheme(value);
                keepFocus(renderStrip);
              },
            },
            label,
          ),
        ]),
      ),
      h("button", { type: "button", class: "link-button", onclick: share }, "Udostępnij to wydanie"),
      shareNote ? h("span", { role: "status" }, shareNote) : null,
    ),
  );
}

async function share() {
  const url = await app.shareUrl();
  shareNote = (await copy(url)) ? "Link skopiowany." : `Link: ${url}`;
  keepFocus(renderStrip);
}

function issueNumber() {
  return diffDays(app.state.week, mondayOf(app.data.term.start)) / 7 + 1;
}

function renderDateline() {
  const plans = app.activePlans();
  const title = plans.map((p) => p.name.replace(/^\d{3}\s*[-_ ]\s*/, "")).join(" + ");
  const week = app.state.mode === "week";
  fill(
    $("dateline"),
    h("span", {}, week ? h("b", {}, `Wydanie nr ${issueNumber()}`) : h("b", {}, "Wydanie typowe")),
    h("span", {}, week ? app.weekLabel() : app.data.term.name),
    h("span", {}, title),
    h("span", {}, `Stan na ${stamp(app.data.fetchedAt)}`),
  );
}

function renderSections() {
  const week = app.state.mode === "week";
  const choice = (label, options, current, pick) =>
    h(
      "span",
      { class: "group", role: "group", "aria-label": label },
      h("span", { class: "label" }, label),
      options.map(([value, text]) => h("button", { type: "button", "aria-pressed": String(value === current), onclick: () => pick(value) }, text)),
    );
  const first = mondayOf(app.data.term.start);
  fill(
    $("sections"),
    choice("Wydanie", [["typical", "typowe"], ["week", "tygodniowe"]], app.state.mode, app.setMode),
    week
      ? h(
          "span",
          { class: "group" },
          h("button", { type: "button", disabled: app.state.week <= first, onclick: () => app.shiftWeek(-1) }, "← poprzednie"),
          h("span", { class: "issue", "aria-live": "polite" }, `nr ${issueNumber()}`),
          h("button", { type: "button", disabled: addDays(app.state.week, 7) > app.data.term.end, onclick: () => app.shiftWeek(1) }, "następne →"),
        )
      : choice("Tygodnie", [["all", "wszystkie"], ["odd", "nieparzyste"], ["even", "parzyste"]], app.state.parity, app.setParity),
  );
}

function showBulletin(label, text, link) {
  const box = $("bulletin");
  box.hidden = false;
  fill(box, h("span", { class: "smallcaps" }, label), h("p", {}, text), link ? h("p", {}, link) : null);
}

function renderBulletin() {
  if (app.status === "ok") {
    $("bulletin").hidden = true;
    return;
  }
  const plan = app.activePlans()[0];
  const labels = { cache: "Komunikat", sync: "Komunikat", error: "Wydanie wstrzymane", empty: "Brak zajęć" };
  showBulletin(
    labels[app.status],
    statusMessage(app.status, app.data, plan),
    app.status === "error" || app.status === "empty" ? h("a", { href: plan.usosUrl }, "Ten plan w USOSweb") : null,
  );
}

// ---------- strona z dniami ----------

function inkClass(unit) {
  const key = app.colorKey(unit);
  return key.startsWith("type-") ? `c-${key.slice(5)}` : `c-${key}`;
}

function renderPage() {
  const page = $("page");
  if (app.status === "error") {
    page.classList.add("is-empty");
    fill(page);
    return;
  }
  page.classList.remove("is-empty");
  const view = app.state.mode === "week" ? app.calendarWeek() : app.typicalWeek();
  page.style.setProperty("--days", view.days.length);
  fill(page, view.days.map(renderDay));
}

function dayNote(day) {
  if (app.state.mode !== "week") return null;
  if (day.outside) return "Poza semestrem.";
  if (day.dayOff) return "Dzień wolny od zajęć.";
  if (day.beforeClasses) return "Zajęcia jeszcze się nie zaczęły.";
  if (day.afterClasses) return "Sesja, bez zajęć.";
  return null;
}

function renderDay(day) {
  const meta = [];
  if (day.date) meta.push(longDate(day.date));
  if (day.weekNo) meta.push(`tydz. ${day.weekNo}, ${day.parity === "odd" ? "nieparzysty" : "parzysty"}`);
  const swap = day.swapFrom !== null && day.swapFrom !== undefined;
  const note = dayNote(day);
  return h(
    "section",
    { class: "day", "aria-label": DAY_NAMES[day.weekday] },
    h(
      "header",
      { class: "day__head" },
      h("h2", { class: "day__name" }, DAY_NAMES[day.weekday]),
      h("div", { class: "day__meta" }, meta.join(" · ")),
      swap
        ? h("div", { class: "day__flag" }, `Zajęcia jak w ${dayAccusative(day.swapFrom)}`)
        : h("div", { class: `day__flag${day.conflicts ? " clash" : ""}` }, day.conflicts ? `${day.conflicts} ${plural(day.conflicts, "kolizja", "kolizje", "kolizji")}` : ""),
    ),
    day.items.length ? clusters(day.items).map(renderCluster) : h("p", { class: "day__note" }, note ?? "Brak zajęć."),
  );
}

// Zajęcia nakładające się w czasie trafiają do jednej ramki, obok siebie.
function clusters(items) {
  const sorted = [...items].sort((a, b) => a.activity.start.localeCompare(b.activity.start) || a.lane - b.lane);
  const groups = [];
  let end = "";
  for (const item of sorted) {
    if (!groups.length || item.activity.start >= end) {
      groups.push([item]);
      end = item.activity.end;
    } else {
      groups.at(-1).push(item);
      if (item.activity.end > end) end = item.activity.end;
    }
  }
  return groups;
}

// W wąskiej szpalcie zajęcia z jednej ramki stoją jedne pod drugimi. Obok
// siebie łamałyby tytuły w połowie wyrazów.
function renderCluster(items) {
  if (items.length === 1) return story(items[0]);
  const clash = items.some((i) => i.conflict);
  return h(
    "div",
    { class: clash ? "clash-box" : "lanes-box" },
    h("div", { class: "box-label" }, clash ? "Kolizja: zajęcia w tym samym czasie" : "Ta sama pora, różne tygodnie"),
    items.map(story),
  );
}

function story(item) {
  const u = item.activity;
  const open = app.isFocused(u);
  const spanInfo = app.state.mode === "typical" ? app.span(u) : null;
  const changes = u.members.flatMap((m) => app.changesFor(m));
  const change = changes.find((c) => c.kind === "modified");
  const fresh = changes.length > 0 && !change;
  const parity = u.recurrence === "odd" ? "tyg. N" : u.recurrence === "even" ? "tyg. P" : u.recurrence === "mixed" ? "tyg. N/P" : null;
  const kicker = [`${u.start}–${u.end}`, TYPE_WORDS[u.type] ?? app.typeName(u.type), app.groupsLabel(u), parity, fresh ? "nowe" : null].filter(Boolean);
  const by = u.block ? "blok, grupę wybierasz osobno" : u.members.length > 1 ? `${u.lecturers.length} ${plural(u.lecturers.length, "prowadzący", "prowadzących", "prowadzących")}` : app.lecturersLabel(u);
  return [
    h(
      "button",
      {
        type: "button",
        class: `story ${inkClass(u)}${item.conflict ? " is-clash" : ""}${open ? " is-open" : ""}`,
        dataset: { key: u.id, subject: u.subject, type: u.type },
        "aria-expanded": String(open),
        onclick: () => app.select(open ? null : u),
      },
      h("span", { class: "story__kicker" }, h("span", { class: "t" }, kicker[0]), ` · ${kicker.slice(1).join(" · ")}`),
      h("span", { class: "story__head" }, u.subjectName),
      h("span", { class: "story__by" }, by),
      spanInfo?.partial ? h("span", { class: "story__note" }, `Tylko ${spanInfo.label}.`) : null,
      u.changedTime ? h("span", { class: "story__note" }, h("b", {}, "Uwaga"), " tego dnia o innej godzinie niż zwykle.") : null,
      change ? h("span", { class: "story__note" }, h("b", {}, "Zmiana"), ` ${app.describeChange(change).title}.`) : null,
    ),
    open ? more(u) : null,
  ];
}

function more(u) {
  const single = u.members.length === 1;
  const spanInfo = app.span(u);
  const clashes = app.conflictsOf(u);
  const changes = u.members.flatMap((m) => app.changesFor(m));
  const dates = app.allDates(u);
  return h(
    "div",
    { class: "more", dataset: { key: `${u.id}#more` } },
    h(
      "dl",
      {},
      h("dt", {}, "Przedmiot"),
      h("dd", {}, h("a", { href: subjectUrl(u.subject) }, u.subject)),
      h("dt", {}, "Zajęcia"),
      h("dd", {}, app.typeName(u.type)),
      h("dt", {}, "Kiedy"),
      h("dd", {}, app.recurrenceLabel(u)),
      single ? [h("dt", {}, "Gdzie"), h("dd", {}, app.place(u) ?? "sala nieznana")] : null,
      single && !u.block ? [h("dt", {}, "Prowadzi"), h("dd", {}, people(u))] : null,
      spanInfo ? [h("dt", {}, "Spotkania"), h("dd", {}, `${spanInfo.countLabel}: ${datesText(dates)}`)] : null,
      app.activePlans().length > 1 ? [h("dt", {}, "Z planów"), h("dd", {}, app.sourcesLabel(u))] : null,
    ),
    single
      ? null
      : h(
          "div",
          { class: "members" },
          u.members.map((m) =>
            h(
              "div",
              { class: "member" },
              h("b", {}, `Grupa ${m.group}`),
              m.recurrence === "odd" ? ", tyg. nieparzyste" : m.recurrence === "even" ? ", tyg. parzyste" : "",
              ". ",
              m.block ? "Blok." : people(m),
              ", ",
              app.place(m) ?? "sala nieznana",
              ". ",
              h("button", { type: "button", class: "link-button", onclick: () => app.chooseGroup(m.subject, m.type, m.group) }, "To moja grupa"),
            ),
          ),
        ),
    clashes.length ? h("p", {}, h("b", {}, "Koliduje z: "), clashes.map((c) => app.describeClash(u, c)).join("; "), ".") : null,
    changes.map((c) => {
      const d = app.describeChange(c);
      return h("p", {}, h("b", {}, `Gr. ${c.group}, ${d.title}: `), d.rows.map((r, i) => [i ? "; " : "", r.before ? h("s", {}, r.before) : null, r.before && r.after ? " → " : null, r.after ?? ""]), ".");
    }),
    h(
      "div",
      { class: "actions" },
      h("button", { type: "button", class: "link-button", onclick: () => (app.select(null), hideSubject(u.subject)) }, "Ukryj przedmiot"),
      h("button", { type: "button", class: "link-button", onclick: () => (app.select(null), hideType(u.subject, u.type)) }, `Ukryj ${TYPE_WORDS[u.type] ?? u.type}`),
      h("a", { href: groupUrl(u) }, "Grupa w USOSweb"),
    ),
  );
}

function people(activity) {
  if (!activity.lecturers.length) return "prowadzący nieznany";
  return activity.lecturers.flatMap((p, i) => [i ? ", " : "", h("a", { href: personUrl(p.id) }, p.name)]);
}

function datesText(dates) {
  return dates.map(shortDate).join(", ");
}

// ---------- W numerze ----------

function renderContents() {
  const plans = app.activePlans();
  const subjects = app.subjects();
  const hidden = app.hiddenCount();
  fill(
    $("contents"),
    h(
      "section",
      {},
      h("h2", {}, plans.length > 1 ? "Wydanie łączone" : "Wydanie"),
      h(
        "ul",
        { class: "editions" },
        plans.map((p, i) =>
          h(
            "li",
            { class: plans.length > 1 ? `c-plan-${i}` : "" },
            plans.length > 1 ? h("i", { "aria-hidden": "true" }) : null,
            p.name,
            h("span", { class: "code" }, p.code),
            plans.length > 1 ? h("button", { type: "button", class: "link-button", onclick: () => app.removePlan(p.code) }, "odłącz") : null,
          ),
        ),
      ),
    ),
    h(
      "section",
      {},
      h("h2", {}, "Działy"),
      hidden ? h("p", {}, h("button", { type: "button", class: "link-button", onclick: app.showAll }, `Pokaż wszystkie (ukryte: ${hidden})`)) : null,
      h(
        "ul",
        { class: "contents" },
        subjects.map((s) =>
          h(
            "li",
            {},
            h(
              "div",
              { class: `entry${s.hidden ? " is-hidden" : ""}` },
              h("span", { class: "entry__name" }, s.name),
              h("button", { type: "button", "aria-label": `${s.hidden ? "Pokaż" : "Ukryj"} przedmiot ${s.name}`, onclick: () => hideSubject(s.code) }, s.hidden ? "pokaż" : "ukryj"),
            ),
            s.hidden
              ? null
              : h(
                  "div",
                  { class: "types" },
                  s.types.map((t) =>
                    h(
                      "span",
                      { class: `c-${t.type}` },
                      h("button", { type: "button", class: `t${t.hidden ? " is-hidden" : ""}`, "aria-label": `${t.hidden ? "Pokaż" : "Ukryj"}: ${t.name}`, onclick: () => hideType(s.code, t.type) }, t.type),
                      !t.hidden && t.groups.length > 1
                        ? h(
                            "span",
                            { class: "groups", role: "group", "aria-label": `Moja grupa: ${t.name}` },
                            t.groups.map((g) => h("button", { type: "button", "aria-pressed": String(t.chosen === g), onclick: () => app.chooseGroup(s.code, t.type, g) }, g)),
                          )
                        : null,
                    ),
                  ),
                ),
          ),
        ),
      ),
    ),
    renderFinder(),
    renderTree(),
  );
}

function renderFinder() {
  const found = query.trim() ? searchGroups(app.data, query) : [];
  return h(
    "section",
    { class: "finder" },
    h("h2", {}, h("label", { for: "finder" }, "Inne kierunki")),
    h("input", {
      id: "finder",
      type: "search",
      value: query,
      placeholder: "kod albo nazwa kierunku",
      autocomplete: "off",
      oninput: (e) => {
        query = e.target.value;
        keepFocus(renderContents);
      },
    }),
    query.trim()
      ? found.length
        ? h(
            "ul",
            {},
            found.map((g) =>
              h(
                "li",
                {},
                g.name,
                h("span", { class: "code" }, g.code),
                h(
                  "span",
                  { class: "acts" },
                  !g.available
                    ? h("span", { class: "muted" }, "brak danych w makiecie")
                    : app.isActive(g.code)
                      ? h("span", { class: "muted" }, "w wydaniu")
                      : [
                          h("button", { type: "button", class: "link-button", onclick: () => ((query = ""), app.openPlan(g.code)) }, "otwórz"),
                          h("button", { type: "button", class: "link-button", onclick: () => ((query = ""), app.addPlan(g.code)) }, "dołącz"),
                        ],
                ),
              ),
            ),
          )
        : h("p", { class: "muted" }, "Nic nie pasuje.")
      : null,
  );
}

function renderTree() {
  const faculties = groupTree(app.data).filter((f) => f.loaded);
  return h(
    "section",
    { class: "tree" },
    h("h2", {}, "Spis kierunków"),
    faculties.map((f) =>
      h(
        "details",
        {},
        h("summary", {}, f.name),
        f.programmes.map((p) =>
          h(
            "details",
            {},
            h("summary", {}, `${p.name}, ${p.level}`),
            p.years.flatMap((y) =>
              y.semesters.map((s) =>
                h(
                  "div",
                  { class: "leaf" },
                  s.available
                    ? h("button", { type: "button", class: "link-button", onclick: () => app.openPlan(s.code) }, `rok ${y.year}, semestr ${s.semester}`)
                    : h("span", { class: "muted" }, `rok ${y.year}, semestr ${s.semester}`),
                ),
              ),
            ),
          ),
        ),
        f.other.length ? h("details", {}, h("summary", {}, "Inne"), f.other.map((g) => h("div", { class: "leaf muted" }, g.name))) : null,
      ),
    ),
    h("p", { class: "muted" }, "Pozostałe wydziały pojawią się po pobraniu indeksu."),
  );
}

// ---------- Z ostatniej chwili ----------

function headline(change) {
  const what = `${app.typeName(change.type)}, gr. ${change.group}`;
  if (change.kind === "added") return null;
  if (change.kind === "removed") return `${change.subjectName}: ${what} usunięte z planu`;
  const fields = new Set(change.fields);
  const [before, after] = [change.before[0], change.after[0]];
  if (fields.has("weekday")) return `${change.subjectName}: ${what} przeniesione ${fromDay(before.weekday)} na ${dayAccusative(after.weekday)}`;
  if (fields.has("start")) return `${change.subjectName}: ${what} o ${after.start} zamiast o ${before.start}`;
  if (fields.has("room") && fields.has("lecturers")) return `${change.subjectName}: ${what} z salą ${after.room} (${after.building}) i nowym prowadzącym`;
  if (fields.has("room")) return `${change.subjectName}: ${what} w sali ${after.room ?? "nieznanej"}`;
  if (fields.has("lecturers")) return `${change.subjectName}: ${what} prowadzi ${after.lecturers.join(", ")}`;
  return `${change.subjectName}: zmiana w ${what}`;
}

function renderNews() {
  const plans = app.historyPlans();
  const legend = h(
    "section",
    {},
    h("h2", {}, "Oznaczenia"),
    h(
      "p",
      { class: "news-lead" },
      app.legend().map((item, i) => [i ? " · " : "", h("span", { class: `smallcaps c-${item.key.replace("type-", "")}`, style: { color: "var(--i)" } }, item.short), ` ${item.label}`]),
      ". Ramka w kolorze czerwonym to kolizja. Tyg. N i P to tygodnie nieparzyste i parzyste.",
    ),
  );
  if (!plans.length) {
    fill($("news"), h("section", {}, h("h2", {}, "Z ostatniej chwili"), h("p", { class: "news-lead" }, "Dla tego kierunku nie zbieramy historii zmian. Historię mają kierunki z listy w konfiguracji strony, na razie 240-ZBI-1S-2R-Z.")), legend);
    return;
  }
  const plan = plans[0];
  const { baseline, latest, changes } = historyOf(plan);
  const modified = changes.filter((c) => c.kind !== "added");
  const added = changes.filter((c) => c.kind === "added");
  const when = `Kraków, ${longDate(latest.at.slice(0, 10))}`;
  fill(
    $("news"),
    h(
      "section",
      {},
      h("h2", {}, "Z ostatniej chwili"),
      h("p", { class: "news-lead" }, `Zmiany w planie ${plan.code} od ${stamp(baseline.at)}. Plan sprawdzamy co 6 godzin.`),
      modified.map((c) => {
        const d = app.describeChange(c);
        return h(
          "article",
          { class: "item", dataset: { key: `news-${c.unit}-${c.group}` } },
          h("h3", { class: "item__head" }, headline(c)),
          h("p", {}, h("span", { class: "place" }, `${when}. `), d.rows.map((r, i) => [i ? " " : "", "Było: ", h("s", {}, r.before), ". Jest: ", r.after, "."])),
        );
      }),
      added.length
        ? h(
            "article",
            { class: "item brief" },
            h("h3", { class: "item__head" }, `Dopisano ${added.length} ${plural(added.length, "grupę zajęciową", "grupy zajęciowe", "grup zajęciowych")}`),
            h("p", {}, h("span", { class: "place" }, `${when}. `), "Od poprzedniej migawki w planie pojawiły się:"),
            h("ul", {}, added.map((c) => h("li", {}, `${c.subjectName}, ${c.type} gr. ${c.group}`))),
          )
        : null,
    ),
    legend,
  );
}

function renderImprint() {
  const plan = app.activePlans()[0];
  fill(
    $("imprint"),
    h("span", {}, "Tygodnik Zajęć jest nieoficjalny i niezwiązany z AGH."),
    h("span", {}, `Dane pobrane ${stamp(app.data.fetchedAt)} z USOS API i stron USOSweb dostępnych bez logowania.`),
    h("a", { href: plan.usosUrl }, "Ten plan w USOSweb"),
  );
}
