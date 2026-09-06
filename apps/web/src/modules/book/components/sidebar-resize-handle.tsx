import { GripVertical } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";

interface SidebarResizeHandleProps {
  width: number;
  onWidthChange: (width: number) => void;
  disabled?: boolean;
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const KEYBOARD_STEP = 16;

export const DEFAULT_CHAPTER_SIDEBAR_WIDTH = 288;

export function clampChapterSidebarWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export function SidebarResizeHandle({
  width,
  onWidthChange,
  disabled = false,
}: SidebarResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, width });

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (event: globalThis.PointerEvent) => {
      onWidthChange(
        clampChapterSidebarWidth(dragStart.current.width + event.clientX - dragStart.current.x),
      );
    };
    const handleEnd = () => setDragging(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
    };
  }, [dragging, onWidthChange]);

  const startDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    dragStart.current = { x: event.clientX, width };
    setDragging(true);
  };

  if (disabled) {
    return <div aria-hidden="true" className="hidden lg:block" />;
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label="Resize chapter sidebar"
      aria-orientation="vertical"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={Math.round(width)}
      onPointerDown={startDragging}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onWidthChange(clampChapterSidebarWidth(width - KEYBOARD_STEP));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onWidthChange(clampChapterSidebarWidth(width + KEYBOARD_STEP));
        }
      }}
      className={`group hidden h-full -translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none lg:flex ${
        dragging ? "[&>span]:opacity-100" : ""
      }`}
    >
      <span className="flex h-9 w-4 items-center justify-center rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-surface-raised)] text-[var(--app-text-subtle)] opacity-0 shadow-xs transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <GripVertical size={12} strokeWidth={1.5} aria-hidden="true" />
      </span>
    </div>
  );
}
