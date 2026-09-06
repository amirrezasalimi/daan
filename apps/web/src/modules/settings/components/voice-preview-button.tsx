import { ActionIcon, Tooltip } from "@mantine/core";
import { Play } from "lucide-react";
import { useRef } from "react";

import { usePreviewVoice } from "../hooks/use-settings";

interface VoicePreviewButtonProps {
  provider: "openai-compatible" | "deepgram";
  endpoint: string;
  apiKey: string;
  model: string;
  voice: string;
}

export function VoicePreviewButton({
  provider,
  endpoint,
  apiKey,
  model,
  voice,
}: VoicePreviewButtonProps) {
  const previewVoice = usePreviewVoice();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playPreview = () => {
    if (!model || !voice || !endpoint) return;
    previewVoice.mutate(
      { provider, endpoint, apiKey, model, voice },
      {
        onSuccess: ({ audio }) => {
          audioRef.current?.pause();
          const element = new Audio(`data:audio/mpeg;base64,${audio}`);
          audioRef.current = element;
          void element.play();
        },
      },
    );
  };

  return (
    <Tooltip label="Preview voice">
      <ActionIcon
        mt={24}
        size="sm"
        variant="subtle"
        aria-label="Preview voice"
        loading={previewVoice.isPending}
        disabled={!model || !voice || !endpoint}
        onClick={playPreview}
      >
        <Play size={14} />
      </ActionIcon>
    </Tooltip>
  );
}
