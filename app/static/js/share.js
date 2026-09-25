// Stan widoku zapisany w samym linku „Udostępnij”.
//
// Token to wersja (jeden znak) i skompresowany JSON w base64url, czyli tylko
// znaki A–Z a–z 0–9 - _. Format jest ten sam co w app/share.py, żeby serwer
// mógł z tego samego tokenu zbudować filtrowany kalendarz.

import { emptySelection, typeKey } from "./plan.js";

export const VERSION = "1";
export const MAX_TOKEN_LENGTH = 4000;
export const MAX_JSON_BYTES = 32 * 1024;
export const MAX_PLANS = 12;

const KINDS = new Set(["g", "p", "z"]);
const MODES = new Set(["typical", "week"]);
const PARITIES = new Set(["all", "odd", "even"]);
const CODE = /^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż./_\- ]{1,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidShareToken extends Error {}

// state: { plans: [{ kind, code, cycle, group? }], selection, mode, parity, week }
export async function encodeState(state) {
  const json = JSON.stringify(toJson(state));
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return VERSION + toBase64Url(packed);
}

export async function decodeState(token) {
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new InvalidShareToken("nieprawidłowa długość");
  if (token[0] !== VERSION) throw new InvalidShareToken(`nieznana wersja ${token[0]}`);
  let data;
  try {
    const raw = await pipe(
      fromBase64Url(token.slice(1)),
      new DecompressionStream("deflate-raw"),
      MAX_JSON_BYTES,
    );
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch (error) {
    if (error instanceof InvalidShareToken) throw error;
    throw new InvalidShareToken("uszkodzony token");
  }
  return fromJson(data);
}

function toJson(state) {
  const data = { p: state.plans.map(planToJson) };
  const sel = state.selection ?? emptySelection();
  if (sel.hiddenSubjects.size) data.hs = [...sel.hiddenSubjects].sort();
  if (sel.hiddenTypes.size) {
    data.ht = [...sel.hiddenTypes].map((key) => key.split("|")).sort(compareTuples);
  }
  if (sel.chosenGroups.size) {
    data.mg = [...sel.chosenGroups]
      .map(([key, group]) => [...key.split("|"), group])
      .sort(compareTuples);
  }
  if (state.mode && state.mode !== "typical") data.m = state.mode;
  if (state.parity && state.parity !== "all") data.par = state.parity;
  if (state.week) data.w = state.week;
  return data;
}

function planToJson(plan) {
  const item = [plan.kind, plan.code, plan.cycle ?? ""];
  if (plan.group !== undefined && plan.group !== null) item.push(plan.group);
  return item;
}

function fromJson(data) {
  if (!isObject(data) || !Array.isArray(data.p)) invalid("brak listy planów");
  if (data.p.length < 1 || data.p.length > MAX_PLANS) {
    invalid(`liczba planów musi być od 1 do ${MAX_PLANS}`);
  }
  const plans = data.p.map(planFromJson);

  const selection = emptySelection();
  for (const subject of list(data.hs)) selection.hiddenSubjects.add(code(subject));
  for (const pair of list(data.ht)) {
    if (!Array.isArray(pair) || pair.length !== 2) invalid("nieprawidłowy typ zajęć");
    selection.hiddenTypes.add(typeKey(code(pair[0]), code(pair[1])));
  }
  for (const triple of list(data.mg)) {
    if (!Array.isArray(triple) || triple.length !== 3) invalid("nieprawidłowy wybór grupy");
    selection.chosenGroups.set(typeKey(code(triple[0]), code(triple[1])), group(triple[2]));
  }

  const mode = data.m ?? "typical";
  const parity = data.par ?? "all";
  if (!MODES.has(mode) || !PARITIES.has(parity)) invalid("nieznany tryb widoku");
  let week = null;
  if (data.w !== undefined) {
    if (typeof data.w !== "string" || !ISO_DATE.test(data.w) || Number.isNaN(Date.parse(data.w))) {
      invalid("nieprawidłowa data");
    }
    week = data.w;
  }
  return { plans, selection, mode, parity, week };
}

function planFromJson(item) {
  if (!Array.isArray(item) || item.length < 3 || item.length > 4) invalid("nieprawidłowy plan");
  if (!KINDS.has(item[0])) invalid(`nieznany rodzaj planu ${item[0]}`);
  const plan = { kind: item[0], code: code(item[1]), cycle: item[2] ? code(item[2]) : "" };
  if (item.length === 4) plan.group = group(item[3]);
  return plan;
}

function code(value) {
  if (typeof value !== "string" || !CODE.test(value)) invalid("nieprawidłowy kod");
  return value;
}

function group(value) {
  if (!Number.isInteger(value) || value < 0 || value >= 10000) invalid("nieprawidłowy numer grupy");
  return value;
}

function list(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) invalid("oczekiwano listy");
  return value;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message) {
  throw new InvalidShareToken(message);
}

function compareTuples(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

async function pipe(bytes, transform, limit = Infinity) {
  const writer = transform.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = transform.readable.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new InvalidShareToken("stan jest za duży");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new InvalidShareToken("niedozwolone znaki");
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
