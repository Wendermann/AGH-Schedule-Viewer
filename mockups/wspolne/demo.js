// Pasek makiety: przejście do pozostałych makiet i podgląd zaprojektowanych
// stanów danych. Nie należy do projektu strony, każda makieta tylko go stylizuje.

import { h, fill } from "./dom.js";
import { STATUSES, STATUS_LABELS } from "./model.js";

const MOCKUPS = [
  ["szwajcarska.html", "Rozkład (szwajcarska)"],
  ["narzedzie.html", "Grafik (narzędzie)"],
  ["gazeta.html", "Tygodnik Zajęć (gazeta)"],
];

export function renderDemoBar(container, app, { current, extra = [] }) {
  const select = h(
    "select",
    { id: "demo-status", onchange: (e) => app.setStatus(e.target.value) },
    STATUSES.map((s) => h("option", { value: s, selected: s === app.status }, STATUS_LABELS[s])),
  );
  fill(
    container,
    h("p", { class: "demo-bar__title" }, "Makieta"),
    h(
      "nav",
      { class: "demo-bar__nav", "aria-label": "Inne makiety" },
      MOCKUPS.map(([href, label]) =>
        href === current ? h("span", { "aria-current": "page" }, label) : h("a", { href }, label),
      ),
    ),
    h("label", { class: "demo-bar__field" }, "Stan danych ", select),
    extra,
  );
}
