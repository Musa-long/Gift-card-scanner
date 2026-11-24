import { insertMany } from "../lib/db.js";
import { neighbours } from "../lib/generate.js";
import { getFormat } from "../lib/checksum/formats.js";
import { normalize } from "../lib/normalize.js";

const [brand, rawSeed, rawRadius] = process.argv.slice(2);
if (!brand || !rawSeed) {
  console.error("usage: npm run seed -- <brand> <code> [radius]");
  process.exit(1);
}

const clean = normalize(rawSeed, brand);
const codes = neighbours(clean, Number(rawRadius ?? 200), getFormat(brand));
const added = await insertMany(brand, codes);
console.log(`normalized ${clean}; queued ${added} new codes`);
process.exit(0);
