import { importDraft, validateDraft } from "./model.ts";
import { loadScenario } from "./fixtures.ts";
import type { Draft } from "./model.ts";
export const STORAGE_KEY = "solution-workbench-draft-v1";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function restore(storage: StorageLike): {
  draft: Draft;
  message: string;
  recovery: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw)
      return { draft: loadScenario("northstar"), message: "", recovery: null };
    try {
      return { draft: importDraft(raw), message: "", recovery: null };
    } catch {
      try {
        storage.setItem(STORAGE_KEY + "-recovery", raw);
      } catch {
        /* Keep a copy in the current page even if storage is full. */
      }
      return {
        draft: loadScenario("northstar"),
        message:
          "The saved brief could not be read. A fresh example is open; download the previous data for recovery.",
        recovery: raw,
      };
    }
  } catch {
    return {
      draft: loadScenario("northstar"),
      message:
        "Browser storage is unavailable. This draft will stay in memory until the page closes.",
      recovery: null,
    };
  }
}
export function persist(storage: StorageLike, draft: Draft) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(validateDraft(draft)));
    return true;
  } catch {
    return false;
  }
}
