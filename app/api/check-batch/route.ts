import { NextResponse } from "next/server";

import { probe } from "@/lib/providers";
import { record, type Row } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMAT: Record<string, RegExp> = {
  amazon: /^[A-Z0-9]{14,20}$/,
  apple: /^[A-Z0-9]{12,20}$/,
  steam: /^[A-Z0-9]{13,17}$/,
  "google-play": /^[A-Z0-9]{16,24}$/,
  playstation: /^[A-Z0-9]{12,20}$/,
  xbox: /^[A-Z0-9]{20,29}$/,
  netflix: /^[A-Z0-9]{10,20}$/,
  spotify: /^[A-Z0-9]{10,20}$/,
  razer: /^[A-Z0-9]{14,20}$/,
  nintendo: /^[A-Z0-9]{12,20}$/,
};

const CONCURRENCY = 8;

export async function POST(req: Request) {
  let body: { codes?: unknown; brand?: unknown; dry?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const brand = String(body.brand ?? "other").toLowerCase();
  const dry = Boolean(body.dry);
  const raw = Array.isArray(body.codes) ? body.codes : [];
  const codes = raw
    .map((c) => String(c).replace(/[\s-]/g, "").toUpperCase())
    .filter(Boolean)
    .slice(0, 100);

  if (!codes.length) {
    return NextResponse.json({ error: "no codes" }, { status: 422 });
  }

  const re = FORMAT[brand];
  const out: Row[] = new Array(codes.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < codes.length) {
      const i = cursor++;
      const code = codes[i];
      const row: Row = {
        code,
        brand,
        state: "unknown",
        value: null,
        currency: null,
        message: null,
        checked_at: new Date().toISOString(),
      };

      if (re && !re.test(code)) {
        row.state = "invalid";
        row.message = "bad format";
      } else if (!dry) {
        try {
          Object.assign(row, await probe(code, brand));
        } catch (err) {
          row.state = "error";
          row.message = (err as Error).message.slice(0, 120);
        }
      }

      out[i] = row;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, codes.length) }, worker),
  );

  if (!dry) out.forEach(record);

  return NextResponse.json(
    { rows: out },
    { headers: { "cache-control": "no-store" } },
  );
}
