import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
export async function sourceHashes() {
  const result = {};
  for (const path of [
    "src/model.ts",
    "src/fixtures.ts",
    "src/proposal.ts",
    "src/files.ts",
    "src/storage.ts",
    "src/App.tsx",
    "src/styles.css",
    "src/main.tsx",
    "worker/index.ts",
  ]) {
    result[path] = createHash("sha256")
      .update((await readFile(path, "utf8")).replace(/\r\n/g, "\n"))
      .digest("hex");
  }
  return result;
}
export async function fingerprint() {
  return createHash("sha256")
    .update(JSON.stringify(await sourceHashes()))
    .digest("hex");
}
