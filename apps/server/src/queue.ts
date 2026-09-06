import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getRecoverableNarrationIds, processNarration } from "@daan/api/narration/service";
import { Queue, Worker, shutdownManager } from "bunqueue/client";

const dataDir = resolve(import.meta.dir, "../data");
mkdirSync(dataDir, { recursive: true });

const dataPath = resolve(dataDir, "bunq.db");
const storage = { embedded: true, dataPath } as const;

interface NarrationJobData {
  recordId: string;
}

const narrationQueueClient = new Queue<NarrationJobData>("narration", {
  ...storage,
  defaultJobOptions: {
    attempts: 3,
    backoff: 2000,
    removeOnComplete: true,
    durable: true,
  },
});

const narrationWorker = new Worker<NarrationJobData>(
  "narration",
  async (job) => {
    if (!job.data?.recordId) throw new Error("Narration job is missing its record id");
    await processNarration(job.data.recordId);
    return { recordId: job.data.recordId };
  },
  { ...storage, concurrency: 2, autorun: false },
);

narrationWorker.on("error", (error) => console.error("Narration worker error:", error));
narrationWorker.on("failed", (job, error) =>
  console.error(`Narration job ${job.id} failed:`, error.message),
);

async function addNarrationJob(recordId: string): Promise<string> {
  const jobId = `narration:${recordId}`;
  await narrationQueueClient.add(
    "generate",
    { recordId },
    {
      timeout: 180_000,
      durable: true,
      jobId,
    },
  );
  return jobId;
}

export const narrationQueue = {
  add: addNarrationJob,
  getActiveCount: () => narrationQueueClient.getActiveCount(),
};

export async function initializeQueues(): Promise<void> {
  narrationWorker.run();
  await narrationWorker.waitUntilReady();
  const recoverableIds = await getRecoverableNarrationIds();
  await Promise.all(recoverableIds.map(addNarrationJob));
}

export async function shutdownQueues(): Promise<void> {
  await narrationWorker.close();
  shutdownManager();
}
