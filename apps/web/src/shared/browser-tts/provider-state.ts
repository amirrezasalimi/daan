let version = 0;
const listeners = new Set<() => void>();

export function emitBrowserTtsStateChange(): void {
  version++;
  for (const listener of listeners) listener();
}

export function subscribeBrowserTtsState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBrowserTtsStateVersion(): number {
  return version;
}
