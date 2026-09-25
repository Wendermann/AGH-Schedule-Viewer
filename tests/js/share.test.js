import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { test } from "node:test";

import { emptySelection, typeKey } from "../../app/static/js/plan.js";
import { InvalidShareToken, decodeState, encodeState } from "../../app/static/js/share.js";

// Wygenerowany przez app/share.py z tego samego stanu co fullState().
const PYTHON_TOKEN =
  "1VYzBCsIwEET_Zc4JJps0Qm_2JnrSQzEhB6GlgohFhYLivzupIHh782Z2XxhRp4QBCuKNjs1a272WnY7FhIUsSVklPJmtOF8FApTLWeF05zHa-D0zFsU95oc_KZy3hw3K_jL8d47ddtVA-blFjanvz5Tj8cZw7TryRBIjgXttKrw_";

function fullState() {
  const selection = emptySelection();
  selection.hiddenSubjects.add("WZ-ZBI-101");
  selection.hiddenTypes.add(typeKey("WZ-ZBI-102", "WYK"));
  selection.chosenGroups.set(typeKey("WZ-ZBI-103", "LAB"), 4);
  return {
    plans: [
      { kind: "g", code: "240-ZBI-1S-2R-Z", cycle: "26/27-Z" },
      { kind: "z", code: "123456", cycle: "", group: 3 },
    ],
    selection,
    mode: "week",
    parity: "odd",
    week: "2026-10-05",
  };
}

test("round trip keeps everything", async () => {
  const state = fullState();
  assert.deepEqual(await decodeState(await encodeState(state)), state);
});

test("minimal state round trips with defaults", async () => {
  const state = { plans: [{ kind: "g", code: "240-ZBI-1S-2R-Z", cycle: "26/27-Z" }] };
  const decoded = await decodeState(await encodeState(state));
  assert.deepEqual(decoded.plans, state.plans);
  assert.equal(decoded.mode, "typical");
  assert.equal(decoded.parity, "all");
  assert.equal(decoded.week, null);
});

test("token uses only url-safe characters and stays short", async () => {
  const token = await encodeState(fullState());
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length < 200, `token ma ${token.length} znaków`);
});

test("token produced by the Python server decodes to the same state", async () => {
  assert.deepEqual(await decodeState(PYTHON_TOKEN), fullState());
});

for (const token of ["", "9abc", "1!!!", "1" + "A".repeat(5000), "1AAAA", "1A"]) {
  test(`garbage is rejected: ${JSON.stringify(token.slice(0, 12))}`, async () => {
    await assert.rejects(decodeState(token), InvalidShareToken);
  });
}

function pack(data) {
  const raw = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
  return "1" + deflateRawSync(raw).toString("base64url");
}

const invalidContents = [
  [],
  { p: [] },
  { p: [["x", "A", ""]] },
  { p: [["g", "<script>", ""]] },
  { p: [["g", "A", ""]], m: "month" },
  { p: [["g", "A", ""]], mg: [["A", "LAB", true]] },
  { p: [["g", "A", ""]], w: "2026-13-45" },
  { p: Array(13).fill(["g", "A", ""]) },
];

for (const data of invalidContents) {
  test(`invalid contents are rejected: ${JSON.stringify(data).slice(0, 40)}`, async () => {
    await assert.rejects(decodeState(pack(data)), InvalidShareToken);
  });
}

test("decompression bomb is rejected", async () => {
  const bomb = Buffer.concat([Buffer.from("["), Buffer.alloc(1_000_000, 32), Buffer.from("]")]);
  await assert.rejects(decodeState(pack(bomb)), InvalidShareToken);
});
