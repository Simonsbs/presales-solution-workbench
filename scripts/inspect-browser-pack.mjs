import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { importDraft } from "../src/model.ts";
import { fingerprint } from "./source-hashes.mjs";

const [path, output] = process.argv.slice(2);
assert.ok(
  path && output,
  "Provide the actual browser ZIP path and report path",
);
const bytes = await readFile(path);
const files = unzipSync(bytes);
assert.deepEqual(Object.keys(files).sort(), [
  "README.txt",
  "analysis.json",
  "architecture.svg",
  "brief.json",
  "decision-record.md",
  "poc-plan.csv",
  "proposal.md",
]);
const draft = importDraft(strFromU8(files["brief.json"]));
const analysis = JSON.parse(strFromU8(files["analysis.json"]));
assert.equal(draft.revision, 2);
assert.equal(draft.baseline.revision, 1);
assert.equal(draft.brief.maxLatencySeconds, 5);
assert.equal(
  draft.edits.summary.text,
  "Public release workshop note: prove one auditable order flow before proposing a rollout.",
);
assert.equal(analysis.analysis.recommended.blueprint.id, "events");
assert.match(strFromU8(files["proposal.md"]), /REVIEW REQUIRED/);
assert.match(strFromU8(files["decision-record.md"]), /Status: Proposed/);
await writeFile(
  "artifacts/public-browser-import.json",
  strFromU8(files["brief.json"]),
);
const report = {
  checkedAt: new Date().toISOString(),
  sourceFingerprint: await fingerprint(),
  method:
    "Independently extracted and inspected the actual UI-downloaded ZIP from https://presales.bestdev.co.il/",
  fileName: path.split(/[\\/]/).at(-1),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  sizeBytes: bytes.length,
  files: Object.keys(files),
  passed: true,
  checks: [
    "Seven fixed-path files extracted",
    "Revision 2 with pinned revision 1",
    "Five-second requirement",
    "Authored wording preserved",
    "Cloud event recommendation",
    "Stale-review flag retained",
    "ADR remains proposed",
  ],
};
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
