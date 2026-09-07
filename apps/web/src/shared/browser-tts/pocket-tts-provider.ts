import { POCKET_TTS_VOICES } from "./pocket-tts-voices";
import { emitBrowserTtsStateChange } from "./provider-state";
import type { BrowserTtsGenerateInput, BrowserTtsLoadProgress, BrowserTtsProvider } from "./types";

interface WorkerResponse {
  id: number;
  type: "progress" | "loaded" | "result" | "error";
  progress?: number;
  status?: string;
  audio?: ArrayBuffer;
  message?: string;
}

interface PendingRequest {
  resolve: (value: ArrayBuffer | undefined) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: BrowserTtsLoadProgress) => void;
}

const MODEL_ID = "kyutai/pocket-tts";

class PocketTtsBrowserProvider implements BrowserTtsProvider {
  readonly id = "browser-pocket-tts";
  readonly name = "Pocket TTS (on-device)";
  readonly models = [{ id: MODEL_ID, name: "Kyutai Pocket TTS (fp16, WebGPU)" }];
  readonly voices = POCKET_TTS_VOICES;

  private worker: Worker | null = null;
  private requestId = 0;
  private loaded = false;
  private pending = new Map<number, PendingRequest>();

  isLoaded(): boolean {
    return this.loaded;
  }

  getLoadedModel(): { id: string; name: string } | null {
    return this.loaded ? (this.models[0] ?? null) : null;
  }

  async load(
    _model: string,
    onProgress?: (progress: BrowserTtsLoadProgress) => void,
  ): Promise<void> {
    if (this.loaded) return;
    await this.request({ type: "load" }, onProgress);
    this.loaded = true;
    emitBrowserTtsStateChange();
  }

  async generate(input: BrowserTtsGenerateInput): Promise<Blob> {
    await this.load(input.model);
    const audio = await this.request({ type: "generate", voice: input.voice, text: input.text });
    if (!audio) throw new Error("Pocket TTS returned no audio");
    return new Blob([audio], { type: "audio/wav" });
  }

  dispose(): void {
    const wasLoaded = this.isLoaded();
    this.worker?.terminate();
    this.worker = null;
    this.loaded = false;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Local TTS provider was stopped"));
    }
    this.pending.clear();
    if (wasLoaded) emitBrowserTtsStateChange();
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL("./pocket-tts.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      if (response.type === "progress") {
        pending.onProgress?.({
          progress: Math.max(0, Math.min(100, response.progress ?? 0)),
          status: response.status ?? "loading",
        });
        return;
      }
      this.pending.delete(response.id);
      if (response.type === "error") {
        pending.reject(new Error(response.message ?? "Local TTS request failed"));
      } else {
        pending.resolve(response.audio);
      }
    });
    this.worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "Local TTS worker failed");
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
      const wasLoaded = this.isLoaded();
      this.loaded = false;
      if (wasLoaded) emitBrowserTtsStateChange();
    });
    return this.worker;
  }

  private request(
    message: Record<string, string>,
    onProgress?: (progress: BrowserTtsLoadProgress) => void,
  ): Promise<ArrayBuffer | undefined> {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.getWorker().postMessage({ id, ...message });
    });
  }
}

export const pocketTtsBrowserProvider = new PocketTtsBrowserProvider();
