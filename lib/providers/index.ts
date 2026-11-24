import "server-only";

import type { Probe, ProbeState } from "./types";

export type { Probe, ProbeState };

export type Provider = {
  brand: string;
  check: (code: string) => Promise<Probe>;
  probe: (code: string) => Promise<Probe>;
};

type Adapter = (code: string) => Promise<Probe>;

const TIMEOUT = 12_000;

const OVERRIDES: Partial<Record<string, Adapter>> = {};

const unknown = (message: string): Probe => ({
  state: "unknown",
  value: null,
  currency: null,
  message,
});

async function viaProxy(code: string, brand: string): Promise<Probe> {
  const base = process.env.GIFTCARD_PROXY;
  if (!base) return unknown("no provider configured");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/balance`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.GIFTCARD_PROXY_TOKEN
          ? { authorization: `Bearer ${process.env.GIFTCARD_PROXY_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ code, brand }),
      signal: ctrl.signal,
      cache: "no-store",
    });

    if (res.status === 404) {
      return { state: "invalid", value: null, currency: null, message: "not found" };
    }
    if (!res.ok) throw new Error(`provider ${res.status}`);

    const j = (await res.json()) as {
      valid?: boolean;
      balance?: number | string | null;
      currency?: string | null;
      redeemed?: boolean;
      message?: string | null;
    };

    const balance =
      j.balance == null || j.balance === "" ? null : Number(j.balance);

    if (j.redeemed) {
      return { state: "used", value: 0, currency: j.currency ?? "USD", message: "already redeemed" };
    }
    if (j.valid === false) {
      return { state: "invalid", value: null, currency: null, message: j.message ?? "invalid" };
    }
    if (balance != null && Number.isFinite(balance)) {
      return {
        state: balance > 0 ? "valid" : "used",
        value: balance,
        currency: j.currency ?? "USD",
        message: j.message ?? null,
      };
    }
    return unknown(j.message ?? "no balance returned");
  } finally {
    clearTimeout(t);
  }
}

export function getProvider(brand: string): Provider {
  const b = brand.trim().toLowerCase();
  const run: Adapter = (code) => {
    const override = OVERRIDES[b];
    return override ? override(code) : viaProxy(code, b);
  };
  return { brand: b, check: run, probe: run };
}

export async function probe(code: string, brand: string): Promise<Probe> {
  return getProvider(brand).check(code);
}
