import { ActionIcon, Progress, Text, Tooltip } from "@mantine/core";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { disposeOtherBrowserTtsProviders, getBrowserTtsProvider } from "@/shared/browser-tts";

interface BrowserVoicePreviewButtonProps {
  serviceId: string;
  model: string;
  voice: string;
}

const SAMPLE_TEXT = "Welcome to Daan. Your books can now speak privately, right in your browser.";
let activePreviewAudio: HTMLAudioElement | null = null;

export function BrowserVoicePreviewButton({
  serviceId,
  model,
  voice,
}: BrowserVoicePreviewButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (activePreviewAudio === audioRef.current) activePreviewAudio = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const preview = async () => {
    if (playing) {
      audioRef.current?.pause();
      if (activePreviewAudio === audioRef.current) activePreviewAudio = null;
      setPlaying(false);
      return;
    }
    activePreviewAudio?.pause();
    activePreviewAudio = null;
    const provider = getBrowserTtsProvider(serviceId);
    if (!provider) return;
    disposeOtherBrowserTtsProviders(provider.id);
    setLoading(true);
    try {
      await provider.load(model, ({ progress: value }) => setProgress(value));
      const blob = await provider.generate({ model, voice, text: SAMPLE_TEXT });
      audioRef.current?.pause();
      if (activePreviewAudio === audioRef.current) activePreviewAudio = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      audio.preservesPitch = true;
      audioRef.current = audio;
      activePreviewAudio = audio;
      audio.addEventListener(
        "ended",
        () => {
          if (activePreviewAudio === audio) activePreviewAudio = null;
          setPlaying(false);
        },
        { once: true },
      );
      await audio.play();
      setPlaying(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not preview local voice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-w-10 flex-col items-center gap-1">
      <Tooltip label={playing ? "Pause preview" : "Preview on this device"}>
        <ActionIcon
          size="sm"
          variant="subtle"
          aria-label={playing ? "Pause voice preview" : "Preview voice"}
          loading={loading}
          onClick={() => void preview()}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </ActionIcon>
      </Tooltip>
      {loading && progress > 0 ? (
        <div className="w-10">
          <Progress value={progress} size={2} radius="xl" />
          <Text size="8px" ta="center" c="var(--app-text-subtle)" mt={2}>
            {Math.round(progress)}%
          </Text>
        </div>
      ) : null}
    </div>
  );
}
