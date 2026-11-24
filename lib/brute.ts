export const SAFE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0 O 1 I L
export const FULL = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const DIGITS = "0123456789";

export type Spec = {
  brand: string;
  alphabet: string;
  length: number;
  prefix: string;
  suffix: string;
};

export function variableWidth(spec: Spec) {
  return Math.max(0, spec.length - spec.prefix.length - spec.suffix.length);
}

export function spaceSize(spec: Spec): bigint {
  return BigInt(spec.alphabet.length) ** BigInt(variableWidth(spec));
}

/** counter → candidate. Zero-padded, base = alphabet length. BigInt safe. */
export function codeAt(spec: Spec, counter: bigint): string {
  const width = variableWidth(spec);
  const base = BigInt(spec.alphabet.length);
  let n = counter;
  let out = "";
  for (let i = 0; i < width; i++) {
    out = spec.alphabet[Number(n % base)] + out;
    n /= base;
  }
  return spec.prefix + out + spec.suffix;
}

/** Luhn mod-10. Digits only — returns "" for mixed alphabets. */
export function luhn(payload: string): string {
  let sum = 0;
  let dbl = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    const d = payload.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return "";
    let v = d;
    if (dbl) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
    dbl = !dbl;
  }
  return String((10 - (sum % 10)) % 10);
}

export function eta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds > 3.15e9) return "centuries";
  const y = Math.floor(seconds / 31536000);
  const d = Math.floor((seconds % 31536000) / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (y) return `${y}y ${d}d`;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function specKey(spec: Spec) {
  return `${spec.brand}:${spec.alphabet.length}:${spec.length}:${spec.prefix}:${spec.suffix}`;
}
