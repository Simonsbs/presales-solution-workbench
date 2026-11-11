import { zipSync, strToU8 } from "fflate";
import { proposalFiles } from "./proposal.ts";
import type { Draft } from "./model.ts";
export function packBytes(draft: Draft, at?: string): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(proposalFiles(draft, at)).map(([name, text]) => [
        name,
        strToU8(text),
      ]),
    ),
    { level: 6 },
  );
}
export function download(name: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const projectSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "solution";
