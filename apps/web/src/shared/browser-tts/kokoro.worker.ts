/// <reference lib="webworker" />

import { KokoroTTS } from "kokoro-js";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

interface LoadMessage {
  id: number;
  type: "load";
  model: string;
}

interface GenerateMessage {
  id: number;
  type: "generate";
  model: string;
  voice: string;
  text: string;
}

type RequestMessage = LoadMessage | GenerateMessage;
type KokoroInstance = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;

let instance: KokoroInstance | null = null;
let loadedModel = "";
let loading: Promise<KokoroInstance> | null = null;

function upstreamModelId(model: string): string {
  return model.split("#", 1)[0]!;
}

function assertWebGpu(): void {
  if (!("gpu" in navigator)) {
    throw new Error(
      "WebGPU is required for on-device speech but is not available in this browser.",
    );
  }
}

async function loadModel(model: string, requestId: number): Promise<KokoroInstance> {
  if (instance && loadedModel === model) return instance;
  if (loading && loadedModel === model) return loading;

  assertWebGpu();
  loadedModel = model;
  loading = KokoroTTS.from_pretrained(upstreamModelId(model), {
    dtype: "fp32",
    device: "webgpu",
    progress_callback: (event) => {
      const progress =
        "progress" in event && typeof event.progress === "number" ? event.progress : 0;
      const status =
        "status" in event && typeof event.status === "string" ? event.status : "loading";
      workerScope.postMessage({ id: requestId, type: "progress", progress, status });
    },
  });
  try {
    instance = await loading;
    return instance;
  } finally {
    loading = null;
  }
}

workerScope.addEventListener("message", async (event: MessageEvent<RequestMessage>) => {
  const request = event.data;
  try {
    const tts = await loadModel(request.model, request.id);
    if (request.type === "load") {
      workerScope.postMessage({ id: request.id, type: "loaded" });
      return;
    }
    const audio = await tts.generate(request.text, {
      voice: request.voice as "af_heart",
      speed: 1,
    });
    const wav = audio.toWav();
    workerScope.postMessage({ id: request.id, type: "result", audio: wav }, [wav]);
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "Local speech generation failed",
    });
  }
});
