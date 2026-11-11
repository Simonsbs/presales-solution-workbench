import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { loadScenario, SCENARIOS } from "../src/fixtures.ts";
import { analyse, revise, importDraft } from "../src/model.ts";
import {
  architectureSvg,
  decisionRecord,
  pocCriteria,
  proposalFiles,
  proposalMarkdown,
  pocCsv,
} from "../src/proposal.ts";
import { packBytes, projectSlug } from "../src/files.ts";
const at = "2026-11-11T14:00:00.000Z";
test("ZIP pack opens to seven fixed-path editable artifacts with a lossless brief", () => {
  const d = loadScenario("northstar");
  const unpacked = unzipSync(packBytes(d, at));
  assert.deepEqual(Object.keys(unpacked).sort(), [
    "README.txt",
    "analysis.json",
    "architecture.svg",
    "brief.json",
    "decision-record.md",
    "poc-plan.csv",
    "proposal.md",
  ]);
  assert.deepEqual(importDraft(strFromU8(unpacked["brief.json"])), d);
  assert.deepEqual(
    JSON.parse(strFromU8(unpacked["analysis.json"])).analysis,
    analyse(d),
  );
  assert.ok(strFromU8(unpacked["proposal.md"]).includes(at));
});
test("all three scenarios export the direction and rejected alternatives of the current brief", () => {
  for (const s of SCENARIOS) {
    const d = revise(s.draft, s.reveal),
      a = analyse(d),
      record = decisionRecord(d);
    assert.match(record, /Status: Proposed/);
    for (const candidate of a.candidates)
      assert.ok(record.includes(candidate.blueprint.name));
    assert.ok(
      proposalMarkdown(d, at).includes(
        a.recommended?.blueprint.name ??
          "No option clears the hard constraints",
      ),
    );
  }
});
test("all-blocked proposal proposes discovery only and its SVG contains no selected topology", () => {
  const d = revise(loadScenario("harbour"), SCENARIOS[1].reveal);
  const md = proposalMarkdown(d, at);
  assert.match(md, /No implementation schedule is proposed/);
  assert.match(md, /No option clears/);
  assert.match(architectureSvg(d), /No feasible architecture selected/);
  assert.ok(!architectureSvg(d).includes("Private broker + services"));
});
test("stale authored wording is preserved and explicitly marked in the exported proposal", () => {
  const d = loadScenario("northstar");
  d.edits.summary = { text: "Customer workshop wording", basedOnRevision: 1 };
  const next = revise(d, (n) => {
    n.brief.maxLatencySeconds = 5;
  });
  const md = proposalMarkdown(next, at);
  assert.match(md, /REVIEW REQUIRED/);
  assert.match(md, /Customer workshop wording/);
  assert.match(md, /STALE, review required/);
  assert.match(md, /Cloud event integration/);
});
test("edited text cannot turn the separate generated decision into a false accepted outcome", () => {
  const d = loadScenario("northstar");
  d.edits.summary = { text: "My own wording", basedOnRevision: 1 };
  const files = proposalFiles(d, at);
  assert.match(files["proposal.md"], /Author-edited section/);
  assert.match(files["decision-record.md"], /Status: Proposed/);
  assert.match(files["proposal.md"], /DRAFT FOR REVIEW/);
  assert.match(files["proposal.md"], /not completed test results/);
});
test("PoC targets derive from the entered freshness, outage, recovery, peak and boundary", () => {
  const d = loadScenario("harbour");
  Object.assign(d.brief, {
    maxLatencySeconds: 7,
    outageMinutes: 41,
    recoveryMinutes: 73,
    peakEventsPerMinute: 123,
    growthPercent: 0,
    headroomPercent: 0,
  });
  const criteria = pocCriteria(d);
  assert.equal(criteria.length, 6);
  assert.match(criteria[0].target, /7 seconds/);
  assert.match(criteria[2].method, /41 minutes/);
  assert.match(criteria[2].target, /73 minutes/);
  assert.match(criteria[3].method, /123 events\/minute/);
  assert.match(criteria[4].target, /No event data leaves/);
});
test("SVG and Markdown treat user text as text rather than executable markup", () => {
  const d = loadScenario("northstar");
  d.brief.project = '<script>alert("x")</script>';
  d.brief.goal = '<img src=x onerror="alert(1)">';
  d.brief.region = "<script>evil</script>";
  const svg = architectureSvg(d),
    md = proposalMarkdown(d, at),
    adr = decisionRecord(d);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!md.includes("<img"));
  assert.ok(!adr.includes("<img"));
  assert.ok(!svg.includes("onerror="));
});
test("PoC CSV quotes cells, escapes quotes and neutralises spreadsheet formulas", () => {
  const d = loadScenario("northstar");
  d.brief.decisionOwner = ' =HYPERLINK("https://example.invalid")';
  const csv = pocCsv(d);
  assert.match(csv, /"' =HYPERLINK\(""https:\/\/example.invalid""\)"/);
  assert.equal(csv.split("\r\n").filter(Boolean).length, 7);
});
test("cost status and currency relabelling remain explicit in every proposal", () => {
  const d = loadScenario("northstar");
  d.costs.currency = "ILS";
  let md = proposalMarkdown(d, at);
  assert.match(md, /ILLUSTRATIVE \/ UNREVIEWED/);
  assert.match(md, /no exchange-rate conversion/);
  d.costs.confirmed = true;
  md = proposalMarkdown(d, at);
  assert.match(md, /user-marked reviewed planning assumptions/);
  assert.match(md, /not a vendor/);
});
test("export filenames never contain user-controlled paths", () => {
  assert.equal(projectSlug("../../A < B / C \\ plan"), "a-b-c-plan");
  assert.equal(projectSlug("שלום"), "solution");
  assert.ok(
    Object.keys(proposalFiles(loadScenario("northstar"), at)).every(
      (name) => !/[\\/]/.test(name),
    ),
  );
});
