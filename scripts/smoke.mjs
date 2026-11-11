import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fingerprint } from "./source-hashes.mjs";
const option = (key, fallback) => {
  const i = process.argv.indexOf(key);
  return i < 0 ? fallback : process.argv[i + 1];
};
const base = option("--url", "https://presales.bestdev.co.il"),
  output = resolve(option("--output", "docs/validation/public-smoke.json"));
const report = {
  url: base,
  checkedAt: new Date().toISOString(),
  sourceFingerprint: await fingerprint(),
  checks: [],
};
let html = "";
async function check(name, action) {
  try {
    await action();
    report.checks.push({ name, passed: true });
  } catch (e) {
    report.checks.push({ name, passed: false, error: e.message });
  }
}
await check(
  "HTTPS serves the standalone workbench without sign-in",
  async () => {
    assert.equal(new URL(base).protocol, "https:");
    const r = await fetch(base, { redirect: "error" });
    assert.equal(r.status, 200);
    html = await r.text();
    assert.match(html, /Solution Workbench/);
    assert.match(r.headers.get("content-type"), /text\/html/);
  },
);
await check(
  "scripts, framing, connections and MIME handling are constrained",
  async () => {
    const r = await fetch(base);
    assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(
      r.headers.get("content-security-policy"),
      /connect-src 'self'/,
    );
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("referrer-policy"), "no-referrer");
  },
);
await check("application assets and local font references load", async () => {
  const paths = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(paths.length >= 2);
  for (const path of paths) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /immutable/);
    if (path.endsWith(".css")) {
      const css = await r.text();
      const fonts = [
        ...css.matchAll(/url\((?:["']?)([^)"']+\.woff2)(?:["']?)\)/g),
      ].map((m) => m[1]);
      assert.ok(fonts.length > 0);
      const font = await fetch(new URL(fonts[0], base + path));
      assert.equal(font.status, 200);
      assert.ok((await font.arrayBuffer()).byteLength > 0);
    }
  }
});
await check(
  "README, decisions, validation and favicon are published",
  async () => {
    for (const path of [
      "/docs/README.md",
      "/docs/BUILD_NOTES.md",
      "/docs/VALIDATION.md",
      "/favicon.svg",
    ]) {
      const r = await fetch(base + path);
      assert.equal(r.status, 200);
      assert.ok((await r.text()).length > 0);
    }
  },
);
await check(
  "health identifies the exact tested source and browser-only draft storage",
  async () => {
    const r = await fetch(base + "/api/health"),
      data = await r.json();
    assert.equal(data.ready, true);
    assert.equal(data.sourceFingerprint, report.sourceFingerprint);
    assert.equal(data.draftStorage, "visitor browser only");
    assert.equal(data.modelVersion, 1);
    assert.match(r.headers.get("cache-control"), /no-store/);
  },
);
await check(
  "draft POSTs are rejected, unknown assets are 404 and HEAD has no body",
  async () => {
    assert.equal(
      (
        await fetch(base + "/", {
          method: "POST",
          body: "synthetic-draft-test",
        })
      ).status,
      405,
    );
    assert.equal(
      (await fetch(base + "/api/drafts", { method: "POST", body: "{}" }))
        .status,
      405,
    );
    assert.equal((await fetch(base + "/missing.svg")).status, 404);
    const r = await fetch(base, { method: "HEAD" });
    assert.equal(r.status, 200);
    assert.equal(await r.text(), "");
  },
);
report.passed = report.checks.every((c) => c.passed);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
process.exitCode = report.passed ? 0 : 1;
