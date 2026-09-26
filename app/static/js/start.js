// Strona startowa: wyszukiwarka, drzewo kierunków i ostatnio oglądane plany.

import Alpine from "../vendor/alpinejs/alpine-3.17.4.esm.min.js";
import { groupTree, planHref, searchGroups, stamp } from "./model.js";
import { THEMES, applyTheme, base, loadIndex, readRecent, readTheme } from "./ui.js";

let index;

Alpine.data("startPage", () => ({
  failure: "",
  query: "",
  tree: [],
  open: {},
  recent: [],
  fetchedAt: "",
  cycle: null,
  theme: readTheme(),
  themes: THEMES,

  async init() {
    applyTheme(this.theme);
    try {
      index = await loadIndex();
    } catch (error) {
      this.failure = `Nie udało się wczytać listy kierunków. ${error.message}`;
      return;
    }
    this.cycle = index.cycles.at(-1);
    this.fetchedAt = stamp(index.fetchedAt);
    this.tree = Object.freeze(groupTree(index));
    for (const faculty of this.tree) this.open[faculty.code] = true;
    const known = new Set(index.groups.filter((g) => g.plans.length).map((g) => g.code));
    this.recent = readRecent().filter((p) => known.has(p.code));
  },

  // Zapytanie czytamy zawsze, także przed wczytaniem indeksu: inaczej Alpine
  // nie zapisze zależności od niego i wyniki się nie odświeżą.
  get results() {
    const query = this.query;
    return index ? searchGroups(index, query) : [];
  },
  href(code) {
    return planHref(base, code, this.cycle.id);
  },
  toggleNode(key, el) {
    this.open[key] = el.open;
  },
  setTheme(theme) {
    this.theme = theme;
    applyTheme(theme);
  },
}));

Alpine.start();
