import type { Provider } from "./types.js";

export const apple: Provider = {
  brand: "apple",
  url: "https://www.apple.com/shop/gift-card-balance",
  async probe(page, code) {
    await page.goto(this.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const input = page.locator("input[type='text'], input[name*='code' i]").first();
    await input.waitFor({ timeout: 20_000 });
    await input.fill(code);
    await page.locator("button[type='submit'], form button").first().click();
    const body = (await page.textContent("body")) ?? "";
    if (/not valid|invalid|couldn.t find|not recognized/i.test(body)) return "not_found";
    if (/already been redeemed|already redeemed/i.test(body)) return "already_redeemed";
    if (/\$\s?\d/.test(body)) return "live_funded";
    if (/balance|remaining/i.test(body)) return "live";
    return "unknown";
  },
};
