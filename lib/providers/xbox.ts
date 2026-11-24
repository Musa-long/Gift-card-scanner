import type { Provider } from "./types.js";

export const xbox: Provider = {
  brand: "xbox",
  url: "https://redeem.microsoft.com/",
  async probe(page, code) {
    await page.goto(this.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const input = page.locator("input[type='text'], input[name*='code' i]").first();
    await input.waitFor({ timeout: 20_000 });
    await input.fill(code);
    await page.locator("button[type='submit'], button:has-text('Next')").first().click();
    const body = (await page.textContent("body")) ?? "";
    if (/not valid|invalid|check the code/i.test(body)) return "not_found";
    if (/already (been )?redeemed/i.test(body)) return "already_redeemed";
    if (/\$\s?\d|confirm/i.test(body)) return "live_funded";
    return "unknown";
  },
};
