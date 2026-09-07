import { kokoroBrowserProvider } from "./kokoro-provider";
import { pocketTtsBrowserProvider } from "./pocket-tts-provider";
import { getBrowserTtsStateVersion, subscribeBrowserTtsState } from "./provider-state";
import type { BrowserTtsProvider } from "./types";

const providers = new Map<string, BrowserTtsProvider>([
  [kokoroBrowserProvider.id, kokoroBrowserProvider],
  [pocketTtsBrowserProvider.id, pocketTtsBrowserProvider],
]);

export function getBrowserTtsProvider(id: string): BrowserTtsProvider | null {
  return providers.get(id) ?? null;
}

export function getLoadedBrowserTtsProviders(): BrowserTtsProvider[] {
  return [...providers.values()].filter((provider) => provider.isLoaded());
}

/**
 * Only one on-device model can be resident in GPU memory at a time. Dispose
 * every other local provider before loading/using the given one.
 */
export function disposeOtherBrowserTtsProviders(activeId: string): void {
  for (const [id, provider] of providers) {
    if (id !== activeId) provider.dispose();
  }
}

export { KOKORO_VOICES } from "./kokoro-voices";
export { POCKET_TTS_VOICES } from "./pocket-tts-voices";
export { getBrowserTtsStateVersion, subscribeBrowserTtsState };
export type {
  BrowserTtsGenerateInput,
  BrowserTtsLoadProgress,
  BrowserTtsProvider,
  BrowserTtsVoice,
} from "./types";
