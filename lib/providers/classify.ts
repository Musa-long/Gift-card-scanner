import type { Page } from "playwright";

import type { Raw } from "./types";

const DEAD =
  /(already\s+(been\s+)?redeemed|has\s+been\s+redeemed|no\s+longer\s+(valid|available)|already\s+used|code\s+has\s+expired)/i;

const NOT_FOUND =
  /(not\s+found|invalid|incorrect|doesn'?t\s+exist|no\s+gift\s*card|unable\s+to\s+find|check\s+the\s+code)/i;

const AMOUNT = /(?:\$|USD\s?)\s?([\d,]+(?:\.\d{1,2})?)/i;

export function readBalance(text: string): number | null {
  const m = AMOUNT.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function classify(text: string): Raw {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "unknown";
  if (DEAD.test(t)) return "already_redeemed";
  if (NOT_FOUND.test(t)) return "not_found";
  const balance = readBalance(t);
  if (balance != null && balance > 0) return "live_funded";
  if (balance === 0) return "already_redeemed";
  if (/(balance|remaining|available)/i.test(t)) return "live";
  return "unknown";
}

export const bodyText = (page: Page) => page.innerText("body").catch(() => "");

export async function settle(page: Page, ms = 2500) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(ms);
}

export async function fillAndSubmit(
  page: Page,
  selectors: string[],
  code: string,
): Promise<boolean> {
  for (const sel of selectors) {
    const input = page.locator(sel).first();
    try {
      await input.waitFor({ state: "visible", timeout: 8000 });
      await input.fill(code);
      await input.press("Enter");
      await settle(page);
      return true;
    } catch {
      // try the next selector
    }
  }
  return false;
}
