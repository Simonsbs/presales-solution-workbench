import { mkdir, access, writeFile } from "node:fs/promises";
await mkdir("worker", { recursive: true });
try {
  await access("worker/assets.generated.ts");
} catch {
  await writeFile(
    "worker/assets.generated.ts",
    'export const assets: Record<string,{type:string;body:string}> = {};\nexport const metadata = {sourceFingerprint:"development"};\n',
  );
}
