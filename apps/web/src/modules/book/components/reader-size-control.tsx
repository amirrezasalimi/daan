import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { Minus, RotateCcw, Plus } from "lucide-react";

interface ReaderSizeControlProps {
  value: number;
  pending: boolean;
  onChange: (value: number) => void;
}

const DEFAULT_SIZE = 19;
const MIN_SIZE = 14;
const MAX_SIZE = 28;

export function ReaderSizeControl({ value, pending, onChange }: ReaderSizeControlProps) {
  return (
    <Group
      gap={2}
      wrap="nowrap"
      aria-label="Reader content size"
      className="rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-surface-muted)] p-1"
    >
      <Tooltip label="Decrease content size">
        <ActionIcon
          size="sm"
          variant="subtle"
          color="brand"
          disabled={pending || value <= MIN_SIZE}
          aria-label="Decrease reader content size"
          onClick={() => onChange(Math.max(MIN_SIZE, value - 1))}
        >
          <Minus size={13} />
        </ActionIcon>
      </Tooltip>
      <Text size="xs" c="var(--app-text-muted)" className="w-8 text-center tabular-nums">
        {value}
      </Text>
      <Tooltip label="Reset content size">
        <ActionIcon
          size="sm"
          variant="subtle"
          color="brand"
          disabled={pending || value === DEFAULT_SIZE}
          aria-label="Reset reader content size"
          onClick={() => onChange(DEFAULT_SIZE)}
        >
          <RotateCcw size={12} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Increase content size">
        <ActionIcon
          size="sm"
          variant="subtle"
          color="brand"
          disabled={pending || value >= MAX_SIZE}
          aria-label="Increase reader content size"
          onClick={() => onChange(Math.min(MAX_SIZE, value + 1))}
        >
          <Plus size={13} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

export const DEFAULT_READER_CONTENT_SIZE = DEFAULT_SIZE;
