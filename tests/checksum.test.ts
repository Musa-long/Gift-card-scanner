import test from "node:test";
import assert from "node:assert/strict";
import { checkChar, isChecksumValid } from "../lib/checksum/luhn-mod-n.js";
import { shift, neighbours } from "../lib/generate.js";
import { APPLE, XBOX } from "../lib/checksum/formats.js";

test("generated apple codes self-validate", () => {
  for (let i = 0; i < 200; i++) {
    const body = Array.from({ length: 15 }, () =>
      APPLE.alphabet[Math.floor(Math.random() * APPLE.alphabet.length)]
    ).join("");
    const code = body + checkChar(body, APPLE.alphabet);
    assert.ok(isChecksumValid(code, APPLE.alphabet));
  }
});

test("shift is reversible", () => {
  const base = "0123456789BCDFGHJKMPQRTVWX" + checkChar("0123456789BCDFGHJKMPQRTVWX", XBOX.alphabet);
  assert.equal(shift(shift(base, 7, XBOX), -7, XBOX), base);
});

test("neighbours skip zero and stay unique", () => {
  const seed = "0123456789BCDFGHJKMPQRTVWX" + checkChar("0123456789BCDFGHJKMPQRTVWX", XBOX.alphabet);
  const n = neighbours(seed, 50, XBOX);
  assert.equal(new Set(n).size, n.length);
  assert.ok(!n.includes(seed));
});
