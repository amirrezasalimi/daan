import { Text } from "@mantine/core";
import { BookOpen, FileText, Sparkles } from "lucide-react";

const TIPS = [
  {
    icon: FileText,
    title: "PDF & EPUB",
    body: "Drop either format. Text and structure are parsed locally.",
  },
  {
    icon: BookOpen,
    title: "Auto chapters",
    body: "We read the table of contents and headings to split the book.",
  },
  {
    icon: Sparkles,
    title: "AI mode",
    body: "Switch to AI extraction in settings for tricky layouts.",
  },
] as const;

export function DashboardInspector() {
  return (
    <div>
      <Text fw={600}>How it works</Text>
      <Text size="sm" c="var(--app-text-muted)" mt={4}>
        From file to readable chapters in one step.
      </Text>

      <div className="mt-6 grid gap-3">
        {TIPS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-raised)] p-4"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-accent)]">
              <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <Text size="sm" fw={600}>
              {title}
            </Text>
            <Text size="xs" c="var(--app-text-subtle)" mt={4}>
              {body}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
