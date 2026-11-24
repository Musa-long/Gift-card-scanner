import { checkChar } from "./checksum/luhn-mod-n.js";
import { getFormat, type Format } from "./checksum/formats.js";

const toBig = (s: string, alphabet: string): bigint => {
  const base = BigInt(alphabet.length);
  let v = 0n;
  for (const c of s) v = v * base + BigInt(alphabet.indexOf(c));
  return v;
};

const fromBig = (v: bigint, len: number, alphabet: string): string => {
  const base = BigInt(alphabet.length);
  let out = "";
  for (let i = 0; i < len; i++) {
    out = alphabet[Number(v % base)] + out;
    v /= base;
  }
  return out;
};

/** Shift a code by offset positions in its own alphabet, recomputing any check digit. */
export function shift(code: string, offset: number, format: Format): string {
  const bodyLen = format.hasCheckDigit ? format.length - 1 : format.length;
  const body = code.slice(0, bodyLen);
  const shifted = fromBig(toBig(body, format.alphabet) + BigInt(offset), bodyLen, format.alphabet);
  return format.hasCheckDigit ? shifted + checkChar(shifted, format.alphabet) : shifted;
}

/** Neighbourhood around a seed, ordered nearest-first so cheap hits land early. */
export function neighbours(seed: string, radius: number, format: Format): string[] {
  const out: string[] = [];
  for (let d = 1; d <= radius; d++) {
    out.push(shift(seed, d, format));
    if (d <= radius) out.push(shift(seed, -d, format));
  }
  return out.filter((c) => c.length === format.length);
}

export function randomCode(brand: string): string {
  const f = getFormat(brand);
  const bodyLen = f.hasCheckDigit ? f.length - 1 : f.length;
  let body = "";
  for (let i = 0; i < bodyLen; i++) {
    body += f.alphabet[Math.floor(Math.random() * f.alphabet.length)];
  }
  return f.hasCheckDigit ? body + checkChar(body, f.alphabet) : body;
}

export function randomBatch(brand: string, count: number): string[] {
  return Array.from({ length: count }, () => randomCode(brand));
}
