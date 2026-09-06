import type { TtsModelRef } from "@daan/api/config/schema";
import { ActionIcon, Badge, Group, Select, Slider, Text, Tooltip } from "@mantine/core";
import { Loader2, Pause, Play, RefreshCcw, RotateCcw, Volume2, VolumeX, X } from "lucide-react";

interface NarrationPlayerProps {
  activeIndex: number;
  activeWorkerCount: number;
  currentText: string;
  duration: number;
  error: string | null;
  generatePending: boolean;
  isPlaying: boolean;
  modelOptions: Array<{ value: string; label: string }>;
  progress: number;
  resetPending: boolean;
  selection: TtsModelRef;
  status: string;
  total: number;
  volume: number;
  onChangeModel: (value: string | null) => void;
  onChangeVolume: (value: number) => void;
  onClose: () => void;
  onRegenerate: () => void;
  onReset: () => void;
  onSeek: (seconds: number) => void;
  onTogglePlayback: () => void;
}

function selectionValue(selection: TtsModelRef): string | null {
  if (!selection.service || !selection.model || !selection.voice) return null;
  return `${selection.service}::${selection.model}::${selection.voice}`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function NarrationPlayer({
  activeIndex,
  activeWorkerCount,
  currentText,
  duration,
  error,
  generatePending,
  isPlaying,
  modelOptions,
  progress,
  resetPending,
  selection,
  status,
  total,
  volume,
  onChangeModel,
  onChangeVolume,
  onClose,
  onRegenerate,
  onReset,
  onSeek,
  onTogglePlayback,
}: NarrationPlayerProps) {
  const preparing = generatePending || status === "pending" || status === "processing";

  return (
    <aside className="absolute bottom-5 right-5 z-20 w-[min(24rem,calc(100%-2.5rem))] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-4 shadow-md">
      <Group justify="space-between" mb="sm">
        <div>
          <Group gap={6} align="center">
            <Text size="sm" fw={600} c="var(--app-text)">
              Narration
            </Text>
            {activeWorkerCount > 0 ? (
              <Tooltip label="Active narration workers">
                <Badge
                  size="xs"
                  variant="light"
                  color="brand"
                  leftSection={<Loader2 size={10} className="animate-spin" />}
                >
                  {activeWorkerCount}
                </Badge>
              </Tooltip>
            ) : null}
          </Group>
          <Text size="xs" c="var(--app-text-subtle)" className="tabular-nums">
            Paragraph {Math.min(activeIndex + 1, total || 1)} of {total}
          </Text>
        </div>
        <Group gap={4}>
          <Tooltip label="Reset chapter narration">
            <ActionIcon
              variant="subtle"
              aria-label="Reset chapter narration"
              loading={resetPending}
              onClick={onReset}
            >
              <RotateCcw size={15} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon variant="subtle" aria-label="Close narration" onClick={onClose}>
            <X size={16} />
          </ActionIcon>
        </Group>
      </Group>

      <Select
        size="xs"
        searchable
        placeholder="Select a voice"
        data={modelOptions}
        value={selectionValue(selection)}
        onChange={onChangeModel}
      />

      <Text size="sm" c="var(--app-text-muted)" lineClamp={2} mt="md" mb={error ? 4 : "md"}>
        {currentText || "Select a paragraph to begin."}
      </Text>
      {error ? (
        <Text size="xs" c="var(--app-danger)" mb="md" lineClamp={2}>
          {error}
        </Text>
      ) : null}

      <Slider
        mb={6}
        size="xs"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(progress, duration || 1)}
        disabled={duration <= 0}
        label={formatTime}
        thumbLabel="Narration position"
        onChange={onSeek}
      />
      <Group justify="space-between" align="center">
        <Text size="xs" c="var(--app-text-subtle)" className="tabular-nums">
          {preparing
            ? "Preparing audio…"
            : status === "failed"
              ? "Generation failed"
              : `${formatTime(progress)} / ${formatTime(duration)}`}
        </Text>
        <Group gap="sm" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            {volume === 0 ? (
              <VolumeX size={15} aria-hidden="true" className="text-[var(--app-text-subtle)]" />
            ) : (
              <Volume2 size={15} aria-hidden="true" className="text-[var(--app-text-subtle)]" />
            )}
            <Slider
              className="w-16"
              size="xs"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              label={(value) => `${Math.round(value * 100)}%`}
              thumbLabel="Narration volume"
              onChange={onChangeVolume}
            />
          </Group>
          <Tooltip label="Regenerate current paragraph">
            <ActionIcon
              variant="subtle"
              aria-label="Regenerate current paragraph"
              loading={generatePending}
              onClick={onRegenerate}
            >
              <RefreshCcw size={16} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            size="lg"
            variant="filled"
            color="brand"
            aria-label={isPlaying ? "Pause narration" : "Play narration"}
            onClick={onTogglePlayback}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </ActionIcon>
        </Group>
      </Group>
    </aside>
  );
}
