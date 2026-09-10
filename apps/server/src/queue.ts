import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  getRecoverableNarrationPreparationRunIds,
  processNarrationPreparation,
} from "@daan/api/narration/preparation-service";
import { getRecoverableNarrationIds, processNarration } from "@daan/api/narration/service";
import { Queue, Worker, shutdownManager } from "bunqueue/client";

const dataDir = resolve(import.meta.dir, "../data");
mkdirSync(dataDir, { recursive: true });

const dataPath = resolve(dataDir, "bunq.db");
const storage = { embedded: true, dataPath } as const;

interface NarrationJobData {
  recordId: string;
}

interface NarrationPreparationJobData {
  runId: string;
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

const narrationPreparationQueueClient = new Queue<NarrationPreparationJobData>(
  "narration-preparation",
  {
    ...storage,
    defaultJobOptions: {
      attempts: 3,
      backoff: 3000,
      removeOnComplete: true,
      durable: true,
    },
  },
);

const narrationWorker = new Worker<NarrationJobData>(
  "narration",
  async (job) => {
    if (!job.data?.recordId) throw new Error("Narration job is missing its record id");
    await processNarration(job.data.recordId);
    return { recordId: job.data.recordId };
  },
  { ...storage, concurrency: 2, autorun: false },
);

const narrationPreparationWorker = new Worker<NarrationPreparationJobData>(
  "narration-preparation",
  async (job) => {
    if (!job.data?.runId) throw new Error("Narration preparation job is missing its run id");
    await processNarrationPreparation(job.data.runId);
    return { runId: job.data.runId };
  },
  { ...storage, concurrency: 1, autorun: false },
);

narrationWorker.on("error", (error) => console.error("Narration worker error:", error));
narrationWorker.on("failed", (job, error) =>
  console.error(`Narration job ${job.id} failed:`, error.message),
);
narrationPreparationWorker.on("error", (error) =>
  console.error("Narration preparation worker error:", error),
);
narrationPreparationWorker.on("failed", (job, error) =>
  console.error(`Narration preparation job ${job.id} failed:`, error.message),
);

async function addNarrationJob(recordId: string): Promise<string> {
  const jobId = `narration:${recordId}`;
  await narrationQueueClient.add(
    "generate",
    { recordId },
    { timeout: 180_000, durable: true, jobId },
  );
  return jobId;
}

async function addNarrationPreparationJob(runId: string): Promise<string> {
  const jobId = `narration-preparation:${runId}`;
  await narrationPreparationQueueClient.add(
    "prepare",
    { runId },
    { timeout: 600_000, durable: true, jobId },
  );
  return jobId;
}

export const narrationQueue = {
  add: addNarrationJob,
  getActiveCount: () => narrationQueueClient.getActiveCount(),
};

export const narrationPreparationQueue = {
  add: addNarrationPreparationJob,
  getActiveCount: () => narrationPreparationQueueClient.getActiveCount(),
};

export async function initializeQueues(): Promise<void> {
  narrationWorker.run();
  narrationPreparationWorker.run();
  await Promise.all([
    narrationWorker.waitUntilReady(),
    narrationPreparationWorker.waitUntilReady(),
  ]);
  const [recoverableNarrationIds, recoverablePreparationIds] = await Promise.all([
    getRecoverableNarrationIds(),
    getRecoverableNarrationPreparationRunIds(),
  ]);
  await Promise.all([
    ...recoverableNarrationIds.map(addNarrationJob),
    ...recoverablePreparationIds.map(addNarrationPreparationJob),
  ]);
}

export async function shutdownQueues(): Promise<void> {
  await Promise.all([narrationWorker.close(), narrationPreparationWorker.close()]);
  shutdownManager();
}
