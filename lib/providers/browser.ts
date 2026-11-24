import "server-only";

import { chromium, type Browser } from "playwright";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browser;
}
