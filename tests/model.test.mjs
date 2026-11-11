import test from "node:test";
import assert from "node:assert/strict";
import {
  analyse,
  estimate,
  validateDraft,
  importDraft,
  revise,
  pinBaseline,
  baselineAnalysis,
  staleEdits,
  differences,
  ValidationError,
} from "../src/model.ts";
import { SCENARIOS, loadScenario } from "../src/fixtures.ts";
const expected = {
  northstar: ["workflow", "events"],
  harbour: ["private", null],
  lumen: ["events", "private"],
};
for (const scenario of SCENARIOS) {
  test(`${scenario.id}: baseline and revealed constraint select the expected direction`, () => {
    const before = analyse(scenario.draft),
      after = analyse(revise(scenario.draft, scenario.reveal));
    assert.equal(
      before.recommended?.blueprint.id ?? null,
      expected[scenario.id][0],
    );
    assert.equal(
      after.recommended?.blueprint.id ?? null,
      expected[scenario.id][1],
    );
    assert.ok(
      after.candidates.every(
        (c) => !c.blockers.length || after.recommended !== c,
      ),
    );
  });
  test(`${scenario.id}: golden defaults are valid and loading cannot mutate their source`, () => {
    assert.deepEqual(validateDraft(scenario.draft), scenario.draft);
    const copy = loadScenario(scenario.id);
    copy.brief.project = "Changed";
    assert.notEqual(scenario.draft.brief.project, "Changed");
  });
}
test("Northstar line items reconcile to independently calculated cents", () => {
  const d = loadScenario("northstar");
  assert.deepEqual(estimate(d.brief, d.costs, "workflow"), {
    fixedCents: 28000,
    trafficCents: 18144,
    operationsCents: 48000,
    monthlyCents: 94144,
    setupCents: 600000,
    yearOneCents: 1729728,
    plannedEvents: 302400,
    plannedPeak: 504,
  });
  assert.equal(estimate(d.brief, d.costs, "events").monthlyCents, 165629);
  assert.equal(estimate(d.brief, d.costs, "private").yearOneCents, 6043260);
});
test("volume planning rounds rational growth upward without binary floating-point over-count", () => {
  const d = loadScenario("northstar");
  d.brief.monthlyEvents = 100;
  d.brief.peakEventsPerMinute = 100;
  d.brief.growthPercent = 10;
  d.brief.headroomPercent = 10;
  assert.equal(estimate(d.brief, d.costs, "workflow").plannedEvents, 121);
  d.brief.monthlyEvents = 1;
  assert.equal(estimate(d.brief, d.costs, "workflow").plannedEvents, 2);
});
test("rounding is per line in cents, before monthly and annual totals", () => {
  const d = loadScenario("northstar");
  Object.assign(d.brief, {
    monthlyEvents: 1,
    growthPercent: 0,
    headroomPercent: 0,
  });
  d.costs.hourlyRate = 0.01;
  d.costs.migrationCost = 0.01;
  d.costs.options.workflow = {
    fixedMonthly: 0.01,
    perThousand: 5,
    opsHours: 0.5,
    setupHours: 0.5,
  };
  const e = estimate(d.brief, d.costs, "workflow");
  assert.equal(e.trafficCents, 1);
  assert.equal(e.operationsCents, 1);
  assert.equal(e.monthlyCents, 3);
  assert.equal(e.setupCents, 2);
  assert.equal(e.yearOneCents, 38);
});
test("private-only beats an arbitrarily high score and low price", () => {
  const d = loadScenario("harbour");
  d.weights = {
    speed: 5,
    operations: 5,
    flexibility: 0,
    reliability: 0,
    cost: 5,
  };
  d.costs.options.workflow = {
    fixedMonthly: 0,
    perThousand: 0,
    opsHours: 0,
    setupHours: 0,
  };
  assert.equal(analyse(d).recommended.blueprint.id, "private");
});
test("insufficient staffing plus private boundary yields no recommendation", () => {
  const d = loadScenario("harbour");
  d.brief.team = "managed-only";
  const a = analyse(d);
  assert.equal(a.recommended, null);
  assert.equal(a.candidates.filter((c) => c.status === "blocked").length, 3);
});
test("deadline and recurring budget are independent hard gates", () => {
  const d = loadScenario("northstar");
  d.brief.deadlineWeeks = 1;
  assert.equal(analyse(d).recommended, null);
  d.brief.deadlineWeeks = 52;
  d.brief.monthlyBudget = 0;
  assert.equal(analyse(d).recommended, null);
  d.brief.monthlyBudget = null;
  assert.ok(analyse(d).recommended);
});
test("budget gate is inclusive at the exact rounded recurring total", () => {
  const d = loadScenario("northstar");
  d.brief.monthlyBudget = 941.44;
  assert.equal(analyse(d).recommended.blueprint.id, "workflow");
  d.brief.monthlyBudget = 941.43;
  assert.equal(analyse(d).recommended, null);
});
test("an unresolved required location is conditional, not silently approved", () => {
  const d = loadScenario("harbour");
  d.costs.confirmed = true;
  d.brief.region = "";
  const a = analyse(d);
  assert.equal(a.recommended.status, "conditional");
  assert.match(
    a.recommended.conditions.join(" "),
    /approve the deployment location/,
  );
});
test("all-zero rates and tied scores avoid division by zero and use documented tie-break", () => {
  const d = loadScenario("northstar");
  d.brief.deadlineWeeks = 52;
  d.brief.team = "platform";
  d.costs.hourlyRate = 0;
  d.costs.migrationCost = 0;
  d.costs.confirmed = true;
  for (const id of ["workflow", "events", "private"])
    d.costs.options[id] = {
      fixedMonthly: 0,
      perThousand: 0,
      opsHours: 0,
      setupHours: 0,
    };
  d.weights = {
    speed: 0,
    operations: 0,
    flexibility: 0,
    reliability: 0,
    cost: 5,
  };
  const a = analyse(d);
  assert.equal(a.recommended.blueprint.id, "workflow");
  assert.ok(a.candidates.every((c) => c.score === 100));
});
test("hard-gate changes do not silently rescale the catalogue's cost grades", () => {
  const d = loadScenario("northstar");
  const before = analyse(d);
  d.brief.maxLatencySeconds = 5;
  const after = analyse(d);
  assert.equal(
    before.candidates[1].ratings.cost,
    after.candidates[1].ratings.cost,
  );
  assert.equal(before.candidates[1].score, after.candidates[1].score);
});
test("contributions add to the displayed weighted score within display rounding", () => {
  const a = analyse(loadScenario("lumen"));
  for (const c of a.candidates) {
    const total = Object.values(c.contributions).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - c.score) <= 0.050001);
    assert.ok(c.score >= 0 && c.score <= 100);
  }
});
test("baseline is a frozen input snapshot and before/after recommendations remain separate", () => {
  const d = pinBaseline(loadScenario("northstar"));
  const changed = revise(d, SCENARIOS[0].reveal);
  assert.equal(baselineAnalysis(changed).recommended.blueprint.id, "workflow");
  assert.equal(analyse(changed).recommended.blueprint.id, "events");
  assert.deepEqual(differences(changed), ["maxLatencySeconds"]);
  assert.equal(changed.baseline.brief.maxLatencySeconds, 900);
});
test("structured revisions preserve authored text, flag stale edits and clear cost review", () => {
  const d = loadScenario("northstar");
  d.costs.confirmed = true;
  d.edits.summary = { text: "Workshop wording", basedOnRevision: 1 };
  const next = revise(d, (n) => {
    n.brief.goal = "A changed objective";
  });
  assert.equal(next.edits.summary.text, "Workshop wording");
  assert.deepEqual(staleEdits(next), ["summary"]);
  assert.equal(next.costs.confirmed, false);
  assert.equal(d.revision, 1);
});
test("JSON import is a lossless round trip including baseline and author review", () => {
  const d = pinBaseline(loadScenario("northstar"));
  d.edits.scope = { text: "A limited scope", basedOnRevision: 1 };
  assert.deepEqual(importDraft(JSON.stringify(d, null, 2)), d);
});
for (const [name, mutate] of [
  [
    "negative money",
    (d) => {
      d.costs.hourlyRate = -1;
    },
  ],
  [
    "non-finite volume",
    (d) => {
      d.brief.monthlyEvents = Infinity;
    },
  ],
  [
    "fractional event count",
    (d) => {
      d.brief.monthlyEvents = 1.5;
    },
  ],
  [
    "excess rate precision",
    (d) => {
      d.costs.options.workflow.perThousand = 0.001;
    },
  ],
  [
    "all-zero weights",
    (d) => {
      d.weights = {
        speed: 0,
        operations: 0,
        flexibility: 0,
        reliability: 0,
        cost: 0,
      };
    },
  ],
  [
    "unknown top-level field",
    (d) => {
      d.admin = true;
    },
  ],
  [
    "unknown nested field",
    (d) => {
      d.brief.bypassPolicy = true;
    },
  ],
  [
    "future reviewed revision",
    (d) => {
      d.edits.summary = { text: "Invalid", basedOnRevision: 10 };
    },
  ],
  [
    "duplicate system names",
    (d) => {
      d.brief.systems = "ERP\nerp";
    },
  ],
  [
    "unsupported schema",
    (d) => {
      d.schemaVersion = 2;
    },
  ],
  [
    "string numeric coercion",
    (d) => {
      d.brief.monthlyEvents = "180000";
    },
  ],
])
  test(`input validation rejects ${name}`, () => {
    const d = loadScenario("northstar");
    mutate(d);
    assert.throws(() => validateDraft(d), ValidationError);
  });
test("import rejects oversized, malformed and prototype-shaped payloads", () => {
  assert.throws(() => importDraft("x".repeat(131073)), /128 KiB/);
  assert.throws(() => importDraft("{"), /valid JSON/);
  assert.throws(
    () => importDraft('{"__proto__":{"admin":true}}'),
    ValidationError,
  );
  assert.equal({}.admin, undefined);
});
test("valid field lengths cannot produce an export too large to reimport", () => {
  const d = loadScenario("northstar");
  for (const id of ["summary", "scope", "assumptions", "risks", "delivery"])
    d.edits[id] = { text: "\u0001".repeat(6000), basedOnRevision: 1 };
  assert.ok(Buffer.byteLength(JSON.stringify(d, null, 2)) > 128 * 1024);
  assert.throws(() => validateDraft(d), /128 KiB/);
});
test("maximum accepted arithmetic stays within safe integer cents", () => {
  const d = loadScenario("northstar");
  Object.assign(d.brief, {
    monthlyEvents: 1000000000,
    peakEventsPerMinute: 1000000,
    growthPercent: 200,
    headroomPercent: 100,
  });
  d.costs.hourlyRate = 10000;
  d.costs.migrationCost = 10000000;
  d.costs.options.workflow = {
    fixedMonthly: 10000000,
    perThousand: 10000,
    opsHours: 100000,
    setupHours: 100000,
  };
  validateDraft(d);
  const e = estimate(d.brief, d.costs, "workflow");
  assert.equal(e.plannedEvents, 6000000000);
  assert.ok(Object.values(e).every(Number.isSafeInteger));
});
