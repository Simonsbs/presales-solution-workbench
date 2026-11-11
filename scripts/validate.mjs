import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { loadScenario, SCENARIOS } from "../src/fixtures.ts";
import {
  analyse,
  revise,
  pinBaseline,
  baselineAnalysis,
  staleEdits,
  estimate,
  importDraft,
} from "../src/model.ts";
import { proposalMarkdown } from "../src/proposal.ts";
import { packBytes } from "../src/files.ts";
import { sourceHashes, fingerprint } from "./source-hashes.mjs";
const index = process.argv.indexOf("--output"),
  output = resolve(
    index < 0 ? "docs/validation/domain.json" : process.argv[index + 1],
  );
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  sourceHashes: await sourceHashes(),
  sourceFingerprint: await fingerprint(),
  scope:
    "Deterministic model and real ZIP export checks using fictional planning inputs. These are workbench tests, not completed customer PoCs or verified vendor capabilities.",
  cases: [],
};
async function check(name, action) {
  const start = performance.now();
  try {
    const details = await action();
    report.cases.push({
      name,
      passed: true,
      elapsedMs: Number((performance.now() - start).toFixed(3)),
      ...details,
    });
  } catch (e) {
    report.cases.push({ name, passed: false, error: e.message });
  }
  console.log(`${report.cases.at(-1).passed ? "PASS" : "FAIL"}: ${name}`);
}
const choices = {
  northstar: ["workflow", "events"],
  harbour: ["private", null],
  lumen: ["events", "private"],
};
for (const scenario of SCENARIOS) {
  for (const changed of [false, true])
    await check(
      `${scenario.id}: ${changed ? "new constraint" : "baseline"} decision and pack`,
      () => {
        const draft = changed
          ? revise(pinBaseline(loadScenario(scenario.id)), scenario.reveal)
          : loadScenario(scenario.id);
        const a = analyse(draft);
        assert.equal(
          a.recommended?.blueprint.id ?? null,
          choices[scenario.id][Number(changed)],
        );
        const zip = packBytes(draft, "2026-11-11T14:00:00.000Z"),
          files = unzipSync(zip);
        assert.equal(Object.keys(files).length, 7);
        assert.deepEqual(importDraft(strFromU8(files["brief.json"])), draft);
        assert.deepEqual(
          JSON.parse(strFromU8(files["analysis.json"])).analysis,
          a,
        );
        if (changed)
          assert.equal(
            baselineAnalysis(draft).recommended?.blueprint.id ?? null,
            choices[scenario.id][0],
          );
        return {
          recommendation: a.recommended?.blueprint.id ?? null,
          candidates: a.candidates.map((c) => ({
            id: c.blueprint.id,
            status: c.status,
            score: c.score,
            blockers: c.blockers,
            monthlyCents: c.estimate.monthlyCents,
          })),
          zipBytes: zip.byteLength,
        };
      },
    );
}
await check(
  "Northstar cost reconciliation against independent expected line totals",
  () => {
    const d = loadScenario("northstar"),
      e = estimate(d.brief, d.costs, "workflow");
    assert.equal(e.plannedEvents, 302400);
    assert.equal(e.monthlyCents, 94144);
    assert.equal(e.setupCents, 600000);
    assert.equal(e.yearOneCents, 1729728);
    return { estimate: e };
  },
);
await check("conflicting deadline returns no recommendation", () => {
  const d = loadScenario("northstar");
  d.brief.deadlineWeeks = 1;
  assert.equal(analyse(d).recommended, null);
});
await check("one-cent budget boundary is respected", () => {
  const d = loadScenario("northstar");
  d.brief.monthlyBudget = 941.44;
  assert.equal(analyse(d).recommended.blueprint.id, "workflow");
  d.brief.monthlyBudget = 941.43;
  assert.equal(analyse(d).recommended, null);
});
await check(
  "intermittent connection excludes the no-outbox workflow baseline",
  () => {
    const d = loadScenario("northstar");
    d.brief.connectivity = "intermittent";
    assert.equal(analyse(d).recommended.blueprint.id, "events");
  },
);
await check(
  "stale authored wording survives and is flagged in the exported proposal",
  () => {
    let d = loadScenario("northstar");
    d.edits.summary = {
      text: "A preserved workshop note.",
      basedOnRevision: 1,
    };
    d = revise(d, SCENARIOS[0].reveal);
    assert.deepEqual(staleEdits(d), ["summary"]);
    assert.match(proposalMarkdown(d), /REVIEW REQUIRED/);
    assert.match(proposalMarkdown(d), /A preserved workshop note/);
  },
);
await check("malformed and oversized imports fail without a draft", () => {
  assert.throws(() => importDraft("{"));
  assert.throws(() => importDraft("x".repeat(131073)));
});
const samples = [];
for (let i = 0; i < 300; i++) {
  const start = performance.now();
  analyse(SCENARIOS[i % 3].draft);
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
report.evaluationTiming = {
  iterations: 300,
  p50Ms: Number(samples[149].toFixed(4)),
  p95Ms: Number(samples[284].toFixed(4)),
  runtime: process.version,
  platform: process.platform,
  scope:
    "Local Node evaluation of three small fixture briefs, 100 evaluations each. Not browser load time, model generation latency, a throughput benchmark or an SLA.",
};
report.finishedAt = new Date().toISOString();
report.summary = {
  passed: report.cases.filter((c) => c.passed).length,
  total: report.cases.length,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary));
process.exitCode = report.summary.passed === report.summary.total ? 0 : 1;
