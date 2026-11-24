import "server-only";

export type CardState = "valid" | "invalid" | "used" | "unknown" | "error";

export type Row = {
  code: string;
  brand: string;
  state: CardState;
  value: number | null;
  currency: string | null;
  message: string | null;
  checked_at: string;
};

type Box = {
  hits: Map<string, Row>;
  tail: Row[];
  counts: Record<string, number>;
};

const g = globalThis as unknown as { __giftcheck?: Box };
const box: Box =
  g.__giftcheck ?? (g.__giftcheck = { hits: new Map(), tail: [], counts: {} });

const TAIL_MAX = 60;

export function record(row: Row) {
  box.counts[row.state] = (box.counts[row.state] ?? 0) + 1;
  if (row.state === "valid") box.hits.set(row.code, row);
  box.tail.unshift(row);
  if (box.tail.length > TAIL_MAX) box.tail.length = TAIL_MAX;
}

export function snapshot() {
  return {
    counts: box.counts,
    hits: [...box.hits.values()]
      .sort((a, b) => b.checked_at.localeCompare(a.checked_at))
      .slice(0, 50),
    tail: box.tail,
  };
}
