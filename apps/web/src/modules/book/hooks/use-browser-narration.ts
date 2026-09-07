import type { TtsModelRef } from "@daan/api/config/schema";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { disposeOtherBrowserTtsProviders, getBrowserTtsProvider } from "@/shared/browser-tts";
import { client, getApiAssetUrl } from "@/shared/utils/orpc";

interface BrowserNarrationProgress {
  active: boolean;
  loadProgress: number;
  status: string;
}

export function useBrowserNarration() {
  const runningRef = useRef(false);
  const [progress, setProgress] = useState<BrowserNarrationProgress>({
    active: false,
    loadProgress: 0,
    status: "",
  });

  const process = useCallback(
    async (chapterId: string, selection: TtsModelRef, onReady: () => void) => {
      const provider = getBrowserTtsProvider(selection.service);
      if (!provider || runningRef.current) return;
      runningRef.current = true;
      disposeOtherBrowserTtsProviders(provider.id);
      setProgress({ active: true, loadProgress: 0, status: "Loading local voice model" });
      try {
        await provider.load(selection.model, ({ progress: value, status }) => {
          setProgress({ active: true, loadProgress: value, status });
        });
        let pending = await client.narration.getPendingBrowserNarrations({ chapterId, selection });
        while (pending.length > 0) {
          for (let index = 0; index < pending.length; index += 1) {
            const item = pending[index]!;
            setProgress({ active: true, loadProgress: 100, status: "" });
            try {
              const audio = await provider.generate({
                model: selection.model,
                voice: selection.voice,
                text: item.text,
              });
              const response = await fetch(getApiAssetUrl(`/narration/browser-audio/${item.id}`), {
                method: "POST",
                headers: { "Content-Type": audio.type || "audio/wav" },
                body: audio,
              });
              if (!response.ok) throw new Error("Could not cache local narration audio");
              onReady();
            } catch (error) {
              const message = error instanceof Error ? error.message : "Local narration failed";
              await client.narration.failBrowserNarration({ recordId: item.id, message });
              throw error;
            }
          }
          pending = await client.narration.getPendingBrowserNarrations({ chapterId, selection });
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Local narration failed");
      } finally {
        runningRef.current = false;
        setProgress({ active: false, loadProgress: provider.isLoaded() ? 100 : 0, status: "" });
        onReady();
      }
    },
    [],
  );

  return { ...progress, process };
}
