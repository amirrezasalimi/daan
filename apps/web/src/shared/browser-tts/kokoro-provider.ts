import { KOKORO_VOICES } from "./kokoro-voices";
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

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX#webgpu-fp32";

class KokoroBrowserProvider implements BrowserTtsProvider {
  readonly id = "browser-kokoro";
  readonly name = "Kokoro (on-device)";
  readonly models = [{ id: MODEL_ID, name: "Kokoro 82M v1.0 (WebGPU fp32)" }];
  readonly voices = KOKORO_VOICES;

  private worker: Worker | null = null;
  private requestId = 0;
  private loadedModel = "";
  private pending = new Map<number, PendingRequest>();

  isLoaded(): boolean {
    return this.loadedModel.length > 0;
  }

  getLoadedModel(): { id: string; name: string } | null {
    if (!this.loadedModel) return null;
    return this.models.find((model) => model.id === this.loadedModel) ?? null;
  }

  async load(
    model: string,
    onProgress?: (progress: BrowserTtsLoadProgress) => void,
  ): Promise<void> {
    if (this.loadedModel === model) return;
    await this.request({ type: "load", model }, onProgress);
    this.loadedModel = model;
    emitBrowserTtsStateChange();
  }

  async generate(input: BrowserTtsGenerateInput): Promise<Blob> {
    await this.load(input.model);
    const audio = await this.request({ type: "generate", ...input });
    if (!audio) throw new Error("Kokoro returned no audio");
    return new Blob([audio], { type: "audio/wav" });
  }

  dispose(): void {
    const wasLoaded = this.isLoaded();
    this.worker?.terminate();
    this.worker = null;
    this.loadedModel = "";
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Local TTS provider was stopped"));
    }
    this.pending.clear();
    if (wasLoaded) emitBrowserTtsStateChange();
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url), { type: "module" });
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
      this.loadedModel = "";
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

export const kokoroBrowserProvider = new KokoroBrowserProvider();
