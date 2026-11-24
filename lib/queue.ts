import PQueue from "p-queue";

const concurrency = Number(process.env.CONCURRENCY ?? 2);

export const queue = new PQueue({ concurrency, interval: 1000, intervalCap: 1 });

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function jittered<T>(task: () => Promise<T>): Promise<T | void> {
  return queue.add(async () => {
    await sleep(800 + Math.random() * 1200);
    return task();
  });
}
