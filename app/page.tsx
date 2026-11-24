"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ColdStart, fetchJson } from "@/lib/api";

type CardState = "pending" | "valid" | "invalid" | "used" | "unknown" | "error";

type Row = {
  id: string;
  code: string;
  brand: string;
  state: CardState;
  value: number | null;
  currency: string | null;
  message: string | null;
  checked_at: string | null;
};

type Stats = { counts: Record<string, number>; hits: Row[]; tail: Row[] };

const BRANDS = [
  "amazon", "apple", "steam", "google-play", "playstation",
  "xbox", "netflix", "spotify", "razer", "nintendo", "other",
] as const;

const LABEL: Record<CardState, string> = {
  pending: "checking",
  valid: "valid",
  invalid: "invalid",
  used: "used",
  unknown: "unknown",
  error: "error",
};

const money = (v: number | null, c: string | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: c || "USD",
      }).format(v);

const when = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

function CardTable({
  rows,
  empty,
  onCopy,
  copied,
}: {
  rows: Row[];
  empty: string;
  onCopy: (code: string) => void;
  copied: string | null;
}) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>code</th>
          <th>brand</th>
          <th>state</th>
          <th>value</th>
          <th>when</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={`${r.id || r.code}-${i}`}
            onClick={() => onCopy(r.code)}
            title="click to copy"
          >
            <td className="code">{copied === r.code ? "copied" : r.code}</td>
            <td>{r.brand}</td>
            <td>
              <span className={`pill ${r.state}`}>{LABEL[r.state] ?? r.state}</span>
              {r.message ? <em className="msg">{r.message}</em> : null}
            </td>
            <td className="value">{money(r.value, r.currency)}</td>
            <td className="muted">{when(r.checked_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Page() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [waking, setWaking] = useState(true);

  const [code, setCode] = useState("");
  const [brand, setBrand] = useState<string>("amazon");
  const [results, setResults] = useState<Row[]>([]);
  const [inflight, setInflight] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const nextDelay = useRef(5000);

  /* ---------- live feed ---------- */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(run, ms);
    };

    const run = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") return schedule(5000);

      ctrl?.abort();
      ctrl = new AbortController();

      try {
        const json = await fetchJson<Stats>("/api/stats", {
          signal: ctrl.signal,
          retries: 10,
        });
        if (cancelled) return;
        setStats(json);
        setFeedError(null);
        setWaking(false);
        nextDelay.current = 5000;
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        if (err instanceof ColdStart) {
          setWaking(true);
          nextDelay.current = Math.min(nextDelay.current * 1.5, 20000);
        } else {
          setFeedError((err as Error).message);
        }
      }
      if (!cancelled) schedule(nextDelay.current);
    };

    run();

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* ---------- scan one code ---------- */
  const scan = useCallback(
    async (raw: string, brandOverride?: string) => {
      const clean = raw.replace(/[\s-]/g, "").toUpperCase();
      if (clean.length < 6) return;

      const b = brandOverride ?? brand;
      const id = `${clean}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setResults((prev) => [
        {
          id,
          code: clean,
          brand: b,
          state: "pending",
          value: null,
          currency: null,
          message: null,
          checked_at: null,
        },
        ...prev,
      ]);
      setInflight((n) => n + 1);

      try {
        const json = await fetchJson<Partial<Row> & { error?: string }>(
          "/api/check",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: clean, brand: b }),
            retries: 4,
          },
        );
        setResults((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...json, id } : r)),
        );
        setWaking(false);
      } catch (err) {
        const cold = err instanceof ColdStart;
        if (cold) setWaking(true);
        setResults((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  state: "error",
                  message: cold ? "service waking, retry" : (err as Error).message,
                }
              : r,
          ),
        );
      } finally {
        setInflight((n) => n - 1);
        inputRef.current?.focus();
      }
    },
    [brand],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    void scan(code);
    setCode("");
  };

  /* ---------- multi-line paste = batch scan ---------- */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n") && !text.includes(",")) return;
    e.preventDefault();
    text
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((c) => void scan(c));
    setCode("");
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1200);
    } catch {
      /* clipboard blocked */
    }
  };

  const hits = useMemo(() => {
    const rows = stats?.hits ?? [];
    if (!filter.trim()) return rows;
    const q = filter.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q),
    );
  }, [stats, filter]);

  return (
    <>
      <style>{`
        :root { color-scheme: dark; }
        body { margin:0; background:#0b0c0f; color:#e7e9ee;
               font:14px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
        main { max-width:900px; margin:0 auto; padding:28px 20px 80px; }
        h1 { font-size:12px; letter-spacing:.16em; text-transform:uppercase;
             color:#7c8494; margin:32px 0 10px; font-weight:600; }
        h1:first-of-type { margin-top:0; color:#e7e9ee; font-size:22px;
             letter-spacing:0; text-transform:none; }
        form { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
        input, select, button { font:inherit; background:#14161c; color:#e7e9ee;
             border:1px solid #262a34; border-radius:6px; padding:9px 11px; }
        input { flex:1; min-width:200px; text-transform:uppercase; }
        input:focus, select:focus, button:focus-visible {
             outline:2px solid #3b82f6; outline-offset:1px; border-color:#3b82f6; }
        button { cursor:pointer; background:#1d2430; }
        button:hover:not(:disabled) { background:#27303f; }
        button:disabled { opacity:.5; cursor:default; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; font-weight:500; color:#7c8494; font-size:11px;
             letter-spacing:.08em; text-transform:uppercase;
             border-bottom:1px solid #262a34; padding:6px 8px; }
        td { padding:7px 8px; border-bottom:1px solid #171a21; vertical-align:top; }
        tbody tr { cursor:pointer; }
        tbody tr:hover { background:#12151b; }
        .code { letter-spacing:.04em; }
        .value { color:#9fe6b4; white-space:nowrap; }
        .muted { color:#6b7280; white-space:nowrap; }
        .pill { display:inline-block; padding:1px 7px; border-radius:99px;
             font-size:11px; border:1px solid; }
        .pill.valid { color:#4ade80; border-color:#1f5133; background:#0f2418; }
        .pill.invalid { color:#f87171; border-color:#5a2020; background:#240f0f; }
        .pill.used { color:#fbbf24; border-color:#57420f; background:#221a05; }
        .pill.unknown { color:#94a3b8; border-color:#333a48; background:#14171d; }
        .pill.error { color:#f0abfc; border-color:#4a1d52; background:#1e0f22; }
        .pill.pending { color:#60a5fa; border-color:#1e3a5f; background:#0d1a29; }
        .msg { display:block; color:#6b7280; font-size:11px; font-style:normal;
             margin-top:3px; }
        .empty { color:#5b6270; font-size:13px; padding:14px 0; }
        .bar { display:flex; gap:14px; align-items:center; flex-wrap:wrap;
             margin:0 0 14px; font-size:12px; color:#7c8494; }
        .count b { color:#e7e9ee; font-size:15px; margin-right:4px; }
        .err { background:#241014; border:1px solid #5a2020; color:#fca5a5;
             padding:9px 12px; border-radius:6px; margin-bottom:14px; font-size:13px; }
        .wake { background:#0d1a29; border:1px solid #1e3a5f; color:#93c5fd;
             padding:9px 12px; border-radius:6px; margin-bottom:14px; font-size:13px; }
        .hint { color:#5b6270; font-size:12px; margin:0 0 18px; }
      `}</style>

      <main>
        <h1>giftcheck</h1>

        <form onSubmit={submit}>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onPaste={onPaste}
            placeholder="paste gift card code"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="gift card code"
          />
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            aria-label="brand"
          >
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!code.trim()}>
            {inflight ? `scanning ${inflight}` : "scan"}
          </button>
        </form>
        <p className="hint">
          enter to scan · paste multiple lines to batch · click a row to copy
        </p>

        {waking ? (
          <div className="wake" role="status">
            instance is starting — retrying automatically
          </div>
        ) : null}

        {feedError ? (
          <div className="err" role="alert">
            live feed: {feedError}
          </div>
        ) : null}

        <h1>this session</h1>
        <CardTable
          rows={results}
          empty="nothing scanned yet"
          onCopy={copy}
          copied={copied}
        />

        {stats ? (
          <>
            <h1>totals</h1>
            <div className="bar">
              {Object.entries(stats.counts).length ? (
                Object.entries(stats.counts).map(([k, v]) => (
                  <span className="count" key={k}>
                    <b>{v}</b>
                    {k}
                  </span>
                ))
              ) : (
                <span>no data</span>
              )}
            </div>

            <h1>confirmed live</h1>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter code or brand"
              aria-label="filter"
              style={{ width: "100%", marginBottom: 10 }}
            />
            <CardTable
              rows={hits}
              empty={filter ? "no matches" : "no confirmed cards yet"}
              onCopy={copy}
              copied={copied}
            />

            <h1>latest activity</h1>
            <CardTable
              rows={stats.tail}
              empty="no activity"
              onCopy={copy}
              copied={copied}
            />
          </>
        ) : null}
      </main>
    </>
  );
        }
