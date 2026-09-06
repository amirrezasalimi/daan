import { ActionIcon, ScrollArea, Text, TextInput, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { useState } from "react";

import { type BookChapter, useChapterSearchQuery } from "../hooks/use-book";

interface ChapterNavProps {
  bookId: string;
  chapters: BookChapter[];
  activeId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: (id: string, matchedTerms: string[]) => void;
}

function formatChapterTitle(title: string): string {
  const letters = title.match(/\p{L}/gu) ?? [];
  const uppercaseLetters = title.match(/\p{Lu}/gu) ?? [];
  if (letters.length === 0 || uppercaseLetters.length / letters.length < 0.8) {
    return title;
  }

  return title
    .toLocaleLowerCase()
    .replace(
      /(^|[^\p{L}\p{N}])(\p{L})/gu,
      (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`,
    );
}

export function ChapterNav({
  bookId,
  chapters,
  activeId,
  collapsed,
  onToggleCollapse,
  onSelect,
}: ChapterNavProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query.trim(), 600);
  const search = useChapterSearchQuery(bookId, debouncedQuery);
  const searching = query.trim().length > 0;
  const results = search.data ?? [];

  if (collapsed) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center">
        <Tooltip label="Expand chapters" position="right">
          <ActionIcon
            variant="subtle"
            color="brand"
            aria-label="Expand chapters"
            onClick={onToggleCollapse}
          >
            <PanelLeftOpen size={17} strokeWidth={1.6} />
          </ActionIcon>
        </Tooltip>

        <ScrollArea className="mt-4 min-h-0 flex-1" type="hover" scrollbars="y">
          <div className="grid gap-1">
            {chapters.map((chapter, index) => {
              const active = chapter.id === activeId;
              return (
                <Tooltip
                  key={chapter.id}
                  label={formatChapterTitle(chapter.title)}
                  position="right"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(chapter.id, [])}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs tabular-nums transition-colors ${
                      active
                        ? "bg-[var(--app-surface-muted)] font-medium text-[var(--app-text)]"
                        : "text-[var(--app-text-subtle)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TextInput
        size="xs"
        radius="xl"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search chapters"
        aria-label="Search chapter titles and contents"
        leftSection={<Search size={14} strokeWidth={1.6} />}
        rightSection={
          query ? (
            <button
              type="button"
              aria-label="Clear chapter search"
              onClick={() => setQuery("")}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--app-text-subtle)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
            >
              <X size={13} strokeWidth={1.7} />
            </button>
          ) : null
        }
        rightSectionPointerEvents={query ? "all" : "none"}
        loading={search.isFetching && Boolean(debouncedQuery)}
        loadingPosition="right"
      />

      <div className="flex items-center justify-between px-1 pb-3 pt-5">
        <Text className="app-eyebrow">{searching ? "Search results" : "Chapters"}</Text>
        <div className="flex items-center gap-2">
          {searching && !search.isFetching ? (
            <Text size="xs" c="var(--app-text-subtle)">
              {results.length}
            </Text>
          ) : null}
          <Tooltip label="Collapse chapters" position="left">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="brand"
              aria-label="Collapse chapters"
              onClick={onToggleCollapse}
            >
              <PanelLeftClose size={16} strokeWidth={1.6} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1" type="hover" scrollbars="y">
        <div className="grid gap-1 pr-2">
          {searching ? (
            results.length === 0 && !search.isFetching ? (
              <Text size="sm" c="var(--app-text-subtle)" px={4} py="sm">
                No matching chapters.
              </Text>
            ) : (
              results.map((result) => {
                const active = result.chapterId === activeId;
                return (
                  <button
                    key={result.chapterId}
                    type="button"
                    onClick={() => onSelect(result.chapterId, result.matchedTerms)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-[var(--app-surface-muted)] text-[var(--app-text)]"
                        : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">
                      {formatChapterTitle(result.title)}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--app-text-subtle)]">
                      {result.excerpt}
                    </span>
                  </button>
                );
              })
            )
          ) : chapters.length === 0 ? (
            <Text size="sm" c="var(--app-text-subtle)" px={4}>
              No chapters detected.
            </Text>
          ) : (
            chapters.map((chapter, index) => {
              const active = chapter.id === activeId;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => onSelect(chapter.id, [])}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-[var(--app-surface-muted)] font-medium text-[var(--app-text)]"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs text-[var(--app-text-subtle)] tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{formatChapterTitle(chapter.title)}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
