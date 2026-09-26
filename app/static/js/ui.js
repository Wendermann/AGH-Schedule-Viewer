// Pomocniki wspólne dla strony startowej i strony planu: wczytywanie danych,
// motyw, ostatnio oglądane widoki i barwy bloczków.

import { fetchJson } from "./model.js";

export const base = document.body.dataset.base ?? "/";

const THEME_KEY = "plan-motyw";
const RECENT_KEY = "plan-ostatnie-widoki";
const RECENT_LIMIT = 6;
const TYPES_WITH_COLOR = new Set(["W", "CWL", "CWA", "CWP"]);

const cycleDir = (cycle) => cycle.replace("/", "-");

export const loadIndex = () => fetchJson(`${base}dane/indeks.json`);
export const loadCycle = (cycle) => fetchJson(`${base}dane/cykle/${cycleDir(cycle)}.json`);
export const loadPlan = (code, cycle) => fetchJson(`${base}dane/plany/${cycleDir(cycle)}/${encodeURIComponent(code)}.json`);

// Pamięć przeglądarki bywa wyłączona; wtedy ustawienia żyją do końca wizyty.
function read(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// Motyw: systemowy (bez atrybutu), jasny albo ciemny.
export function readTheme() {
  return read(THEME_KEY, "system");
}

export function applyTheme(theme) {
  write(THEME_KEY, theme);
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

export const THEMES = [
  ["system", "systemowy"],
  ["light", "jasny"],
  ["dark", "ciemny"],
];

// Ostatnio oglądane widoki: zestaw planów z tokenem „Udostępnij”, więc powrót
// ze strony startowej przywraca też ukryte przedmioty i wybrane grupy.
export function readRecent() {
  try {
    const list = JSON.parse(read(RECENT_KEY, "[]"));
    return Array.isArray(list) ? list.filter((v) => Array.isArray(v?.codes) && v.token && v.title) : [];
  } catch {
    return [];
  }
}

export function rememberView(plans, token) {
  const codes = plans.map((p) => p.code);
  const key = codes.join("+");
  const view = { codes, title: plans.map((p) => p.title).join(" + "), token };
  const list = [view, ...readRecent().filter((v) => v.codes.join("+") !== key)];
  write(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)));
}

// Klasa barwy dla klucza z app.colorKey() albo z legendy.
export function tone(key) {
  if (key === "plan-shared") return "fill-hatch";
  if (key.startsWith("plan-")) return `tone pl-${+key.slice(5) % 4}`;
  const type = key.slice(5);
  return `tone ty-${TYPES_WITH_COLOR.has(type) ? type : "other"}`;
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Klawisze nie działają, gdy użytkownik pisze w polu tekstowym.
export function typing(event) {
  const el = event.target;
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
