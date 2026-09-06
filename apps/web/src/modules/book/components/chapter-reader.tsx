import {
  ActionIcon,
  Button,
  Group,
  ScrollArea,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useChapterContentQuery, type BookChapter } from "../hooks/use-book";
import { type ContentRun, parseContentBlocks } from "../utils/content-blocks";

interface ChapterReaderProps {
  chapter: BookChapter | null;
  highlightTerms: string[];
  nextChapter: BookChapter | null;
  onNextChapter: () => void;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({
  text,
  terms,
}: {
  text: string;
  terms: string[];
}) {
  const pattern = useMemo(() => {
    const uniqueTerms = [...new Set(terms.map((term) => term.trim()))]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    return uniqueTerms.length > 0
      ? new RegExp(`(${uniqueTerms.map(escapeRegExp).join("|")})`, "gi")
      : null;
  }, [terms]);

  if (!pattern) return text;

  const parts = text.split(pattern);
  const nodes: ReactNode[] = parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={`${index}-${part}`}
        data-search-match
        className="rounded-sm bg-[var(--app-warning)]/25 px-0.5 text-inherit transition-colors data-[current=true]:bg-[var(--app-warning)]/55"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={`${index}-${part}`}>{part}</Fragment>
    ),
  );
  return nodes;
}

export function ChapterReader({
  chapter,
  highlightTerms,
  nextChapter,
  onNextChapter,
}: ChapterReaderProps) {
  const { data, isLoading } = useChapterContentQuery(chapter?.id ?? null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const text = (data ?? [])
    .map((block) => block.content ?? "")
    .join("\n\n")
    .trim();

  const blocks = useMemo(() => parseContentBlocks(text), [text]);

  const renderRuns = (runs: ContentRun[]) =>
    runs.map((run, index) => {
      const content = (
        <HighlightedText text={run.text} terms={highlightTerms} />
      );
      return run.bold ? (
        <strong
          key={index}
          className="font-semibold text-[var(--app-text)]"
        >
          {content}
        </strong>
      ) : (
        <Fragment key={index}>{content}</Fragment>
      );
    });

  const scrollToMatch = useCallback((requestedIndex: number) => {
    const matches = Array.from(
      viewportRef.current?.querySelectorAll<HTMLElement>(
        "[data-search-match]",
      ) ?? [],
    );
    if (matches.length === 0) return;

    const index = (requestedIndex + matches.length) % matches.length;
    for (const match of matches) match.removeAttribute("data-current");

    const selected = matches[index];
    selected?.setAttribute("data-current", "true");
    selected?.scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrentMatch(index);
  }, []);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
  }, [chapter?.id]);

  useEffect(() => {
    if (isLoading || highlightTerms.length === 0) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      const matches = viewportRef.current?.querySelectorAll(
        "[data-search-match]",
      );
      const count = matches?.length ?? 0;
      setMatchCount(count);

      if (count > 0) {
        const firstContentMatch = viewportRef.current?.querySelector(
          "[data-search-content] [data-search-match]",
        );
        const firstIndex = firstContentMatch
          ? Array.from(matches ?? []).indexOf(firstContentMatch)
          : 0;
        scrollToMatch(Math.max(0, firstIndex));
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [chapter?.id, highlightTerms, isLoading, scrollToMatch, text]);

  if (!chapter) {
    return (
      <div className="grid h-full place-items-center">
        <Text c="var(--app-text-subtle)">
          Select a chapter to start reading.
        </Text>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" type="auto" viewportRef={viewportRef}>
      {highlightTerms.length > 0 && matchCount > 0 ? (
        <div className="pointer-events-none sticky top-4 z-10 flex h-0 justify-end">
          <Group
            gap="xs"
            wrap="nowrap"
            px="sm"
            py="md"
            mr="lg"
            className="pointer-events-auto rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-surface-raised)] shadow-sm"
          >
              <Text
                size="xs"
                c="var(--app-text-subtle)"
                className="min-w-12 text-right tabular-nums"
              >
                {currentMatch + 1} / {matchCount}
              </Text>
              <Tooltip label="Previous match">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="brand"
                  aria-label="Previous search match"
                  onClick={() => scrollToMatch(currentMatch - 1)}
                >
                  <ChevronUp size={15} strokeWidth={1.8} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Next match">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="brand"
                  aria-label="Next search match"
                  onClick={() => scrollToMatch(currentMatch + 1)}
                >
                  <ChevronDown size={15} strokeWidth={1.8} />
                </ActionIcon>
              </Tooltip>
          </Group>
        </div>
      ) : null}

      <div className="px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <article className="mx-auto w-full max-w-4xl">
        <Text className="app-eyebrow">
          {chapter.startPage != null && chapter.endPage != null
            ? `Pages ${chapter.startPage}–${chapter.endPage}`
            : "Chapter"}
        </Text>

        <Title order={1} className="mt-4 !text-[clamp(2rem,4vw,3.25rem)]">
          <HighlightedText text={chapter.title} terms={highlightTerms} />
        </Title>

        <div
          data-search-content
          className="mt-8 max-w-[68ch] font-serif text-lg leading-8 text-[var(--app-text-muted)]"
        >
          {isLoading ? (
            <Text c="var(--app-text-subtle)">Loading chapter…</Text>
          ) : blocks.length === 0 ? (
            <Text c="var(--app-text-subtle)">
              This chapter has no extracted text.
            </Text>
          ) : (
            blocks.map((block, index) => {
              if (block.type === "heading-2") {
                return (
                  <h2 key={index} className="mb-4 mt-10 font-sans text-2xl font-semibold leading-tight text-[var(--app-text)] first:mt-0">
                    {renderRuns(block.runs)}
                  </h2>
                );
              }
              if (block.type === "heading-3") {
                return (
                  <h3 key={index} className="mb-3 mt-8 font-sans text-xl font-semibold leading-snug text-[var(--app-text)] first:mt-0">
                    {renderRuns(block.runs)}
                  </h3>
                );
              }
              return <p key={index} className="mb-5 whitespace-pre-line">{renderRuns(block.runs)}</p>;
            })
          )}
        </div>

        {nextChapter ? (
          <div className="mt-12 flex max-w-[68ch] justify-end border-t border-[var(--app-border-subtle)] pt-6">
            <Button
              variant="subtle"
              color="brand"
              rightSection={<ArrowRight size={16} strokeWidth={1.7} />}
              onClick={onNextChapter}
            >
              Next chapter
            </Button>
          </div>
        ) : null}
        </article>
      </div>
    </ScrollArea>
  );
}
