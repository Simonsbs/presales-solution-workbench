import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fingerprint } from "./source-hashes.mjs";
const manifest = JSON.parse(
  await readFile("dist/.openai/hosting.json", "utf8"),
);
assert.ok(manifest.project_id);
assert.ok(!manifest.static);
assert.ok(!manifest.d1 && !manifest.r2);
assert.deepEqual((await readdir("dist")).sort(), [".openai", "server"]);
const { default: worker } = await import(
  pathToFileURL(resolve("dist/server/index.js")).href + `?v=${Date.now()}`
);
const response = await worker.fetch(new Request("https://workbench.invalid/"));
assert.equal(response.status, 200);
assert.match(
  response.headers.get("content-security-policy"),
  /script-src 'self'/,
);
assert.equal(response.headers.get("x-frame-options"), "DENY");
const html = await response.text(),
  paths = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
    (m) => m[1],
  );
assert.ok(paths.length >= 2);
for (const path of paths) {
  const r = await worker.fetch(new Request("https://workbench.invalid" + path));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /immutable/);
  assert.ok((await r.arrayBuffer()).byteLength > 0);
}
for (const path of [
  "/docs/README.md",
  "/docs/BUILD_NOTES.md",
  "/docs/VALIDATION.md",
  "/favicon.svg",
]) {
  assert.equal(
    (await worker.fetch(new Request("https://workbench.invalid" + path)))
      .status,
    200,
  );
}
const health = await (
  await worker.fetch(new Request("https://workbench.invalid/api/health"))
).json();
assert.equal(health.sourceFingerprint, await fingerprint());
assert.equal(health.draftStorage, "visitor browser only");
assert.equal(
  (await worker.fetch(new Request("https://workbench.invalid/missing"))).status,
  404,
);
assert.equal(
  (
    await worker.fetch(
      new Request("https://workbench.invalid/", {
        method: "POST",
        body: "private draft",
      }),
    )
  ).status,
  405,
);
assert.equal(
  await (
    await worker.fetch(
      new Request("https://workbench.invalid/", { method: "HEAD" }),
    )
  ).text(),
  "",
);
console.log(
  "PASS: built Worker, application assets, docs, headers, fingerprint and read-only routes",
);
