import type { Provider } from "./types.js";

export const amazon: Provider = {
  brand: "amazon",
  url: "https://www.amazon.com/gp/gift-card-balance",
  async probe(page, code) {
    await page.goto(this.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const input = page.locator("#gc-redemption-input, input[name='gc-redemption-input']").first();
    await input.waitFor({ timeout: 20_000 });
    await input.fill(code);
    await page
      .locator("#gc-redemption-check-balance, input[type='submit'], button[type='submit']")
      .first()
      .click();
    const body = (await page.textContent("body")) ?? "";
    if (/not (a valid|recognized)|invalid gift card/i.test(body)) return "not_found";
    if (/already (been )?redeemed/i.test(body)) return "already_redeemed";
    if (/\$\s?\d+\.\d{2}/.test(body)) return "live_funded";
    if (/balance/i.test(body)) return "live";
    return "unknown";
  },
};
