import test from "node:test";
import assert from "node:assert/strict";
import { restore, persist, STORAGE_KEY } from "../src/storage.ts";
import { loadScenario } from "../src/fixtures.ts";
function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
test("a saved brief, author wording and baseline survive restoration", () => {
  const s = storage(),
    d = loadScenario("lumen");
  d.edits.scope = { text: "A workshop note", basedOnRevision: 1 };
  assert.equal(persist(s, d), true);
  assert.deepEqual(restore(s).draft, d);
});
test("corrupt saved data is retained for recovery and never interpreted as a brief", () => {
  const s = storage({ [STORAGE_KEY]: '{"broken":true}' }),
    r = restore(s);
  assert.equal(r.draft.scenarioId, "northstar");
  assert.equal(r.recovery, '{"broken":true}');
  assert.equal(s.values.get(STORAGE_KEY + "-recovery"), r.recovery);
  assert.match(r.message, /could not be read/);
});
test("blocked browser storage falls back to an in-memory draft", () => {
  const s = {
    getItem: () => {
      throw new Error("disabled");
    },
    setItem: () => {
      throw new Error("disabled");
    },
  };
  assert.equal(restore(s).draft.scenarioId, "northstar");
  assert.equal(persist(s, loadScenario("northstar")), false);
});
test("invalid current input never overwrites the last valid saved draft", () => {
  const s = storage(),
    d = loadScenario("northstar");
  persist(s, d);
  const previous = s.values.get(STORAGE_KEY);
  d.brief.deadlineWeeks = 0;
  assert.equal(persist(s, d), false);
  assert.equal(s.values.get(STORAGE_KEY), previous);
});
