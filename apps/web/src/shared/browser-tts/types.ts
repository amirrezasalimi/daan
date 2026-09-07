export interface BrowserTtsVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
}

export interface BrowserTtsLoadProgress {
  progress: number;
  status: string;
}

export interface BrowserTtsGenerateInput {
  model: string;
  voice: string;
  text: string;
}

export interface BrowserTtsProvider {
  id: string;
  name: string;
  models: Array<{ id: string; name: string }>;
  voices: BrowserTtsVoice[];
  isLoaded(): boolean;
  getLoadedModel(): { id: string; name: string } | null;
  load(model: string, onProgress?: (progress: BrowserTtsLoadProgress) => void): Promise<void>;
  generate(input: BrowserTtsGenerateInput): Promise<Blob>;
  dispose(): void;
}
