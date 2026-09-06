import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Queue, Worker, shutdownManager } from "bunqueue/client";

const dataDir = resolve(import.meta.dir, "../data");
mkdirSync(dataDir, { recursive: true });

const dataPath = resolve(dataDir, "bunq.db");
const storage = { embedded: true, dataPath } as const;

export const defaultQueue = new Queue("default", storage);

export const defaultWorker = new Worker(
  "default",
  async (job) => {
    return { processed: true, data: job.data };
  },
  { ...storage, concurrency: 3 },
);

export async function shutdownQueues(): Promise<void> {
  await defaultWorker.close();
  shutdownManager();
}
