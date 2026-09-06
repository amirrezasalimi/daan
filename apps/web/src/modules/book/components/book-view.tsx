import { Loader } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useState } from "react";

import { WorkspaceFrame } from "@/shared/components";

import { useBookQuery, useChaptersQuery } from "../hooks/use-book";
import { ChapterNav } from "./chapter-nav";
import { ChapterReader } from "./chapter-reader";
import {
  clampChapterSidebarWidth,
  DEFAULT_CHAPTER_SIDEBAR_WIDTH,
  SidebarResizeHandle,
} from "./sidebar-resize-handle";

interface BookViewProps {
  bookId: string;
}

const SIDEBAR_WIDTH_STORAGE_KEY = "daan:chapter-sidebar-width";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "daan:chapter-sidebar-collapsed";
const COLLAPSED_SIDEBAR_WIDTH = 68;

function getSavedSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getSavedSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_CHAPTER_SIDEBAR_WIDTH;
  try {
    const savedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(savedWidth) && savedWidth > 0
      ? clampChapterSidebarWidth(savedWidth)
      : DEFAULT_CHAPTER_SIDEBAR_WIDTH;
  } catch {
    return DEFAULT_CHAPTER_SIDEBAR_WIDTH;
  }
}

export function BookView({ bookId }: BookViewProps) {
  const { data: book, isLoading: bookLoading } = useBookQuery(bookId);
  const { data: chapters, isLoading: chaptersLoading } = useChaptersQuery(bookId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightTerms, setHighlightTerms] = useState<string[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedSidebarWidth);
  const [collapsed, setCollapsed] = useState(getSavedSidebarCollapsed);

  useEffect(() => {
    const saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
      } catch {
        // Storage may be unavailable in privacy-restricted contexts.
      }
    }, 200);
    return () => window.clearTimeout(saveTimer);
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Storage may be unavailable in privacy-restricted contexts.
    }
  }, [collapsed]);

  useEffect(() => {
    if (!activeId && chapters && chapters.length > 0) {
      setActiveId(chapters[0]?.id ?? null);
    }
  }, [chapters, activeId]);

  const title = book?.title ?? "Book";
  const activeIndex = chapters?.findIndex((chapter) => chapter.id === activeId) ?? -1;
  const activeChapter = activeIndex >= 0 ? (chapters?.[activeIndex] ?? null) : null;
  const nextChapter = activeIndex >= 0 ? (chapters?.[activeIndex + 1] ?? null) : null;
  const loading = bookLoading || chaptersLoading;

  const selectChapter = (chapterId: string, matchedTerms: string[]) => {
    setActiveId(chapterId);
    setHighlightTerms(matchedTerms);
  };

  const selectNextChapter = () => {
    if (!nextChapter) return;
    setActiveId(nextChapter.id);
    setHighlightTerms([]);
  };

  return (
    <WorkspaceFrame
      breadcrumb={
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center">
          <Link
            to="/"
            className="shrink-0 rounded-sm text-[var(--app-text-muted)] no-underline transition-colors hover:text-[var(--app-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
          >
            Library
          </Link>
          <span className="px-2 text-[var(--app-text-subtle)]" aria-hidden="true">
            /
          </span>
          <Link
            to="/book/$id"
            params={{ id: bookId }}
            aria-current="page"
            className="truncate rounded-sm text-[var(--app-text)] no-underline transition-colors hover:text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
          >
            {title}
          </Link>
        </nav>
      }
      contentScrollable={false}
    >
      <div
        className="grid h-full min-h-0 grid-cols-1 overflow-hidden bg-[var(--app-canvas)] transition-[grid-template-columns] duration-200 ease-out lg:grid-cols-[var(--chapter-sidebar-width)_var(--chapter-handle-width)_minmax(0,1fr)]"
        style={
          {
            "--chapter-sidebar-width": `${collapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth}px`,
            "--chapter-handle-width": collapsed ? "0px" : "0.75rem",
          } as CSSProperties
        }
      >
        <aside className="hidden min-h-0 overflow-hidden border-r border-[var(--app-border-subtle)] bg-[var(--app-surface)] p-5 lg:block">
          {loading ? (
            <div className="grid place-items-center py-10">
              <Loader size="sm" color="brand" />
            </div>
          ) : (
            <ChapterNav
              bookId={bookId}
              chapters={chapters ?? []}
              activeId={activeId}
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed((value) => !value)}
              onSelect={selectChapter}
            />
          )}
        </aside>

        <SidebarResizeHandle
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          disabled={collapsed}
        />

        <div className="min-h-0 overflow-hidden">
          {loading ? (
            <div className="grid h-full place-items-center">
              <Loader color="brand" />
            </div>
          ) : (
            <ChapterReader
              chapter={activeChapter}
              highlightTerms={highlightTerms}
              nextChapter={nextChapter}
              onNextChapter={selectNextChapter}
            />
          )}
        </div>
      </div>
    </WorkspaceFrame>
  );
}
