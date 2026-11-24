import { chromium } from "playwright";
import { claim, mark, releaseStale, insertMany } from "../lib/db.js";
import { getProvider } from "../lib/providers/index.js";
import { toState } from "../lib/providers/types.js";
import { jittered, queue } from "../lib/queue.js";
import { alert } from "../lib/alerts.js";
import { neighbours, randomBatch } from "../lib/generate.js";
import { getFormat } from "../lib/checksum/formats.js";
import { normalize } from "../lib/normalize.js";
import { isChecksumValid } from "../lib/checksum/luhn-mod-n.js";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const minutes = Number(arg("minutes", "10"));
const brandFilter = arg("brand") ?? null;
const seed = arg("seed");
const radius = Number(arg("radius", "0"));

async function main() {
  await releaseStale();

  if (seed && brandFilter) {
    const f = getFormat(brandFilter);
    const clean = normalize(seed, brandFilter);
    const generated = neighbours(clean, radius, f);
    const added = await insertMany(brandFilter, generated);
    console.log(`seeded ${added} neighbours of ${clean}`);
  } else if (brandFilter) {
    const added = await insertMany(brandFilter, randomBatch(brandFilter, 500));
    console.log(`queued ${added} random ${brandFilter} codes`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  const deadline = Date.now() + minutes * 60_000;
  let checked = 0;
  let hits = 0;

  while (Date.now() < deadline) {
    const batch = await claim(brandFilter, 10);
    if (!batch.length) break;

    for (const row of batch) {
      const f = getFormat(row.brand);
      if (f.hasCheckDigit && !isChecksumValid(row.code, f.alphabet)) {
        await mark(row.code, "format_invalid");
        continue;
      }
      await jittered(async () => {
        try {
          const raw = await getProvider(row.brand).probe(page, row.code);
          const state = toState(raw);
          await mark(row.code, state);
          checked++;
          if (state === "live" || state === "live_funded") {
            hits++;
            console.log(`HIT ${state} ${row.code}`);
            await alert(row.code, row.brand, state);
          }
        } catch {
          await mark(row.code, "error");
        }
      });
    }
    console.log(`checked=${checked} hits=${hits} queued=${queue.size + queue.pending}`);
  }

  await queue.onIdle();
  await browser.close();
  console.log(`done: checked=${checked} hits=${hits}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
