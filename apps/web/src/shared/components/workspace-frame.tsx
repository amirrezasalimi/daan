import { ActionIcon } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { type ReactNode, useState } from "react";

import { SettingsModal } from "@/modules/settings";

import { ModeToggle } from "./mode-toggle";

interface WorkspaceFrameProps {
  breadcrumb: ReactNode;
  children: ReactNode;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  headerActions?: ReactNode;
  contentScrollable?: boolean;
}

export function WorkspaceFrame({
  breadcrumb,
  children,
  sidebar,
  inspector,
  headerActions,
  contentScrollable = true,
}: WorkspaceFrameProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <main className="h-dvh min-h-0 overflow-hidden bg-[var(--app-canvas)]">
        <section className="grid h-full w-full grid-rows-[auto_1fr] overflow-hidden bg-[var(--app-surface)]">
          <header className="border-b border-[var(--app-border-subtle)] bg-[var(--app-surface)] px-5 py-3.5 sm:px-7">
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[1fr_1.5fr_1fr]">
              <Link
                to="/"
                className="app-display w-fit text-xl tracking-[-0.04em] text-[var(--app-text)] no-underline"
              >
                DAAN
              </Link>

              <div className="hidden min-w-0 text-sm text-[var(--app-text-muted)] lg:block">
                {breadcrumb}
              </div>

              <div className="flex items-center justify-end gap-2">
                {headerActions}
                <ModeToggle />
                <ActionIcon
                  variant="default"
                  size="lg"
                  aria-label="Settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings size={17} strokeWidth={1.5} />
                </ActionIcon>
              </div>
            </div>
          </header>

          <div
            className={`grid min-h-0 ${
              sidebar && inspector
                ? "lg:grid-cols-[15rem_minmax(0,1fr)_18rem]"
                : sidebar
                  ? "lg:grid-cols-[15rem_minmax(0,1fr)]"
                  : inspector
                    ? "lg:grid-cols-[minmax(0,1fr)_18rem]"
                    : "grid-cols-1"
            }`}
          >
            {sidebar ? (
              <aside className="hidden min-h-0 border-r border-[var(--app-border-subtle)] bg-[var(--app-surface)] p-6 lg:block">
                {sidebar}
              </aside>
            ) : null}

            <div
              className={`min-h-0 min-w-0 ${contentScrollable ? "overflow-y-auto" : "overflow-hidden"}`}
            >
              {children}
            </div>

            {inspector ? (
              <aside className="hidden min-h-0 overflow-y-auto border-l border-[var(--app-border-subtle)] bg-[var(--app-surface)] p-6 lg:block">
                {inspector}
              </aside>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}
