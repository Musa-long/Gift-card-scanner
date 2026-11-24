export class ColdStart extends Error {
  constructor() {
    super("service is waking up");
    this.name = "ColdStart";
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });

/**
 * Same-origin JSON fetch that survives Render's cold-start interstitial,
 * which answers 200 text/html on every path while the instance boots.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { retries?: number } = {},
): Promise<T> {
  const { retries = 8, ...rest } = init;
  let attempt = 0;
  let delay = 800;

  for (;;) {
    const res = await fetch(url, { cache: "no-store", ...rest });
    const type = res.headers.get("content-type") ?? "";

    if (type.includes("application/json")) {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    }

    // HTML (or anything not JSON) = interstitial, not a real failure.
    if (attempt >= retries) throw new ColdStart();
    await sleep(delay, rest.signal ?? undefined);
    delay = Math.min(Math.round(delay * 1.8), 8000);
    attempt++;
  }
}
