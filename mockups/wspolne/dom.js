// Drobne pomocniki DOM wspólne dla makiet.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith("on")) el.addEventListener(name.slice(2), value);
    else if (name === "class") el.className = value;
    else if (name === "style" && typeof value === "object") {
      for (const [prop, v] of Object.entries(value)) {
        if (prop.startsWith("--")) el.style.setProperty(prop, v);
        else el.style[prop] = v;
      }
    }
    else if (name === "dataset") Object.assign(el.dataset, value);
    else el.setAttribute(name, value === true ? "" : value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Motyw i tak działa do końca wizyty.
  }
}

// Motyw: systemowy (bez atrybutu), jasny albo ciemny.
export function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

// Klawisze nie działają, gdy użytkownik pisze w polu tekstowym.
export function typing(event) {
  const el = event.target;
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

// Przerysowanie zastępuje elementy, więc fokus wraca na element o tym samym
// kluczu: najbliższy kontener z id i etykieta albo tekst kontrolki.
function focusKey(el) {
  if (!(el instanceof HTMLElement) || el === document.body) return null;
  if (el.id) return `#${el.id}`;
  const scope = el.closest("[id]")?.id ?? "";
  return `${scope}|${el.tagName}|${el.getAttribute("aria-label") ?? el.textContent.trim()}`;
}

export function keepFocus(render) {
  const key = focusKey(document.activeElement);
  render();
  if (!key || focusKey(document.activeElement) === key) return;
  if (key.startsWith("#")) {
    document.getElementById(key.slice(1))?.focus();
    return;
  }
  const scope = document.getElementById(key.split("|")[0]) ?? document;
  for (const el of scope.querySelectorAll("button, a, input, select, summary")) {
    if (focusKey(el) === key) {
      el.focus();
      return;
    }
  }
}
