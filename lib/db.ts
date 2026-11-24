import pg from "pg";

const ssl = process.env.PGSSL === "off" ? undefined : { rejectUnauthorized: false };
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl });

export type State =
  | "pending" | "checking" | "format_invalid" | "not_found"
  | "already_redeemed" | "live" | "live_funded" | "error";

export async function insertMany(brand: string, codes: string[]): Promise<number> {
  if (!codes.length) return 0;
  const client = await pool.connect();
  let added = 0;
  try {
    await client.query("begin");
    for (let i = 0; i < codes.length; i += 500) {
      const r = await client.query(
        `insert into codes (code, brand)
         select unnest($1::text[]), $2
         on conflict (code) do nothing
         returning code`,
        [codes.slice(i, i + 500), brand]
      );
      added += r.rowCount ?? 0;
    }
    await client.query("commit");
    return added;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function claim(brand: string | null, limit: number) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ code: string; brand: string }>(
      `select code, brand from codes
       where state in ('pending','error')
         and attempts < 3
         and ($1::text is null or brand = $1)
       order by first_seen
       limit $2
       for update skip locked`,
      [brand, limit]
    );
    if (rows.length) {
      await client.query(
        `update codes set state='checking', attempts=attempts+1, checked_at=now()
         where code = any($1::text[])`,
        [rows.map((r) => r.code)]
      );
    }
    await client.query("commit");
    return rows;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function mark(code: string, state: State, note?: string) {
  await pool.query(`update codes set state=$2, checked_at=now(), note=$3 where code=$1`, [
    code, state, note ?? null,
  ]);
}

/** Requeue rows a crashed worker left mid-flight. */
export async function releaseStale() {
  await pool.query(
    `update codes set state='error'
     where state='checking' and checked_at < now() - interval '10 minutes'`
  );
}

export async function stats() {
  const counts = await pool.query<{ state: string; n: string }>(
    `select state, count(*)::text as n from codes group by state`
  );
  const recent = await pool.query(
    `select code, brand, state, first_seen, checked_at from codes
     where state in ('live','live_funded')
     order by checked_at desc nulls last limit 50`
  );
  const tail = await pool.query(
    `select code, brand, state, checked_at from codes
     order by checked_at desc nulls last limit 40`
  );
  return {
    counts: Object.fromEntries(counts.rows.map((r) => [r.state, Number(r.n)])),
    hits: recent.rows,
    tail: tail.rows,
  };
}
