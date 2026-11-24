import type { Page } from "playwright";
import type { State } from "../db.js";

export type Raw = "not_found" | "already_redeemed" | "live" | "live_funded" | "unknown";

export type Provider = {
  brand: string;
  url: string;
  /** Runs one check in an already-open page. */
  probe: (page: Page, code: string) => Promise<Raw>;
};

export const toState = (raw: Raw): State =>
  raw === "unknown" ? "error" : raw;
