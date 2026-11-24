"use client";

import { useEffect, useState } from "react";

type Row = { code: string; brand: string; state: string; checked_at?: string };

export default function Page() {
  const [data, setData] = useState<{ counts: Record<string, number>; hits: Row[]; tail: Row[] }>();

  useEffect(() => {
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <p>loading…</p>;

  return (
    <>
      <h1>giftcheck</h1>
      <div className="counts">
        {Object.entries(data.counts).map(([k, v]) => (
          <div className="count" key={k}>
            <b>{v}</b>
            {k}
          </div>
        ))}
      </div>

      <h1>confirmed live</h1>
      <table>
        <thead>
          <tr><th>code</th><th>brand</th><th>state</th><th>when</th></tr>
        </thead>
        <tbody>
          {data.hits.map((r) => (
            <tr key={r.code}>
              <td>{r.code}</td>
              <td>{r.brand}</td>
              <td className={r.state}>{r.state}</td>
              <td>{r.checked_at ? new Date(r.checked_at).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h1>latest activity</h1>
      <table>
        <thead>
          <tr><th>code</th><th>brand</th><th>state</th><th>when</th></tr>
        </thead>
        <tbody>
          {data.tail.map((r) => (
            <tr key={r.code}>
              <td>{r.code}</td>
              <td>{r.brand}</td>
              <td className={r.state}>{r.state}</td>
              <td>{r.checked_at ? new Date(r.checked_at).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
