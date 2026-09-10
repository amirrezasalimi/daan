import type { TtsModelRef } from "@daan/api/config/schema";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Progress,
  Select,
  Slider,
  Text,
  Tooltip,
} from "@mantine/core";
import { Loader2, Pause, Play, RefreshCcw, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useState } from "react";

interface NarrationPlayerProps {
  activeIndex: number;
  activeWorkerCount: number;
  browserLoadProgress: number;
  browserStatus: string;
  cachedNarrationCount: number;
  duration: number;
  error: string | null;
  generatePending: boolean;
  isPlaying: boolean;
  modelOptions: Array<{ value: string; label: string }>;
  playbackSpeed: number;
  progress: number;
  resetPending: boolean;
  selection: TtsModelRef;
  status: string;
  total: number;
  volume: number;
  onChangeModel: (value: string | null) => void;
  onChangePlaybackSpeed: (value: number) => void;
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
  browserLoadProgress,
  browserStatus,
  cachedNarrationCount,
  duration,
  error,
  generatePending,
  isPlaying,
  modelOptions,
  playbackSpeed,
  progress,
  resetPending,
  selection,
  status,
  total,
  volume,
  onChangeModel,
  onChangePlaybackSpeed,
  onChangeVolume,
  onClose,
  onRegenerate,
  onReset,
  onSeek,
  onTogglePlayback,
}: NarrationPlayerProps) {
  const [resetConfirmationOpened, setResetConfirmationOpened] = useState(false);
  const preparing = generatePending || status === "pending" || status === "processing";
  const confirmReset = () => {
    onReset();
    setResetConfirmationOpened(false);
  };

  return (
    <>
      <Modal
        opened={resetConfirmationOpened}
        onClose={() => setResetConfirmationOpened(false)}
        title="Reset chapter narration?"
        size="sm"
        radius="lg"
        centered
      >
        <Text size="sm" c="var(--app-text-muted)">
          This permanently removes {cachedNarrationCount} saved narration{" "}
          {cachedNarrationCount === 1 ? "item" : "items"} for this chapter, including all voices.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => setResetConfirmationOpened(false)}>
            Cancel
          </Button>
          <Button
            disabled={cachedNarrationCount === 0}
            loading={resetPending}
            onClick={confirmReset}
            className="!bg-[var(--app-danger)]"
          >
            Reset {cachedNarrationCount} {cachedNarrationCount === 1 ? "item" : "items"}
          </Button>
        </Group>
      </Modal>
      <aside className="absolute bottom-4 right-4 z-20 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-4 shadow-md sm:bottom-6 sm:right-6 sm:w-[min(24rem,calc(100%-3rem))] sm:p-5">
        <Group justify="space-between" mb="lg">
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
                disabled={cachedNarrationCount === 0}
                onClick={() => setResetConfirmationOpened(true)}
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

        {browserStatus ? (
          <div className="mt-4">
            <Group justify="space-between" gap="xs" mb={5}>
              <Text size="xs" c="var(--app-text-muted)" lineClamp={1}>
                {browserStatus}
              </Text>
              {browserLoadProgress > 0 && browserLoadProgress < 100 ? (
                <Text size="xs" c="var(--app-text-subtle)" className="tabular-nums">
                  {Math.round(browserLoadProgress)}%
                </Text>
              ) : null}
            </Group>
            <Progress value={browserLoadProgress} size="xs" radius="xl" animated />
          </div>
        ) : null}

        {error ? (
          <Text size="xs" c="var(--app-danger)" my="md" lineClamp={2}>
            {error}
          </Text>
        ) : null}

        <Slider
          mt="lg"
          mb={8}
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
        <Text size="xs" c="var(--app-text-subtle)" className="tabular-nums">
          {preparing
            ? "Preparing audio…"
            : status === "failed"
              ? "Generation failed"
              : `${formatTime(progress)} / ${formatTime(duration)}`}
        </Text>
        <Group justify="flex-end" gap="sm" wrap="nowrap" mt="md">
          <Select
            className="w-[4.5rem]"
            size="xs"
            variant="unstyled"
            allowDeselect={false}
            aria-label="Playback speed"
            data={[
              { value: "0.75", label: "0.75×" },
              { value: "1", label: "1×" },
              { value: "1.25", label: "1.25×" },
              { value: "1.5", label: "1.5×" },
              { value: "2", label: "2×" },
            ]}
            value={String(playbackSpeed)}
            onChange={(value) => onChangePlaybackSpeed(Number(value ?? 1))}
            styles={{ input: { textAlign: "right" } }}
          />
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
      </aside>
    </>
  );
}
