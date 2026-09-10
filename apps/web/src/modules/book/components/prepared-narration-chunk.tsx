import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { Eye, EyeOff, Languages, WandSparkles } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";

import type { NarrationSegment } from "../hooks/use-narration";

interface PreparedNarrationChunkProps {
  active: boolean;
  index: number;
  segment: NarrationSegment;
  renderText: (text: string) => ReactNode;
  onSelect?: (index: number) => void;
}

export function PreparedNarrationChunk({
  active,
  index,
  segment,
  renderText,
  onSelect,
}: PreparedNarrationChunkProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const translated = Boolean(segment.preparationTargetLanguage);
  const styled = Boolean(segment.preparationStyle && segment.preparationStyle !== "neutral");
  const prepared = Boolean(segment.preparationProviderId);
  const visibleText = showOriginal ? segment.originalContent : segment.content;
  const select = () => onSelect?.(index);
  const handleKeyDown = (event: KeyboardEvent<HTMLParagraphElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    select();
  };

  return (
    <div className="group/chunk relative mb-6 last:mb-0">
      {prepared ? (
        <Group
          gap={4}
          wrap="nowrap"
          className="pointer-events-none absolute -left-2 top-0 -translate-x-full opacity-0 transition-opacity group-hover/chunk:pointer-events-auto group-hover/chunk:opacity-100 group-focus-within/chunk:pointer-events-auto group-focus-within/chunk:opacity-100"
        >
          {translated ? (
            <Tooltip label={`Translated to ${segment.preparationTargetLanguage}`}>
              <span
                aria-label={`Translated to ${segment.preparationTargetLanguage}`}
                className="grid size-6 place-items-center rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-surface-muted)] text-[var(--app-accent)]"
              >
                <Languages size={13} aria-hidden="true" />
              </span>
            </Tooltip>
          ) : null}
          {styled ? (
            <Tooltip label={`${segment.preparationStyle} narration style`}>
              <span
                aria-label={`${segment.preparationStyle} narration style applied`}
                className="grid size-6 place-items-center rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-surface-muted)] text-[var(--app-accent)]"
              >
                <WandSparkles size={13} aria-hidden="true" />
              </span>
            </Tooltip>
          ) : null}
          <Tooltip label={showOriginal ? "Show prepared version" : "Compare with original"}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="brand"
              aria-label={
                showOriginal ? "Show prepared narration text" : "Show original source text"
              }
              aria-pressed={showOriginal}
              onClick={() => setShowOriginal((value) => !value)}
            >
              {showOriginal ? <EyeOff size={14} /> : <Eye size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : null}

      <p
        data-narration-index={index}
        data-narration-active={active || undefined}
        role="button"
        tabIndex={0}
        className="-mx-2 cursor-pointer whitespace-pre-line rounded-md px-2 py-1 transition-colors hover:bg-[var(--app-surface-muted)] data-[narration-active=true]:bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)]"
        onClick={select}
        onKeyDown={handleKeyDown}
      >
        {renderText(visibleText)}
      </p>
      {showOriginal ? (
        <Text size="xs" c="var(--app-text-subtle)" mt={4} ml={8}>
          Original source preview · temporary
        </Text>
      ) : null}
    </div>
  );
}
