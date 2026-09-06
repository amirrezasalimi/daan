import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { WorkspaceNavItem, WorkspaceNavLabel } from "./workspace-frame";

interface WorkspaceSidebarProps {
  activeItem: "notes" | "shared" | "trash";
}

export function WorkspaceSidebar({ activeItem }: WorkspaceSidebarProps) {
  return (
    <nav className="flex h-full flex-col" aria-label="Notebook navigation">
      <button
        type="button"
        className="mb-5 flex items-center gap-2 border-y border-[var(--app-border-subtle)] py-4 text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-accent)]"
      >
        <Sparkles size={15} strokeWidth={1.5} aria-hidden="true" />
        Ask AI
      </button>

      <div>
        <WorkspaceNavLabel>Notes editor</WorkspaceNavLabel>
        <Link to="/" className="block no-underline">
          <WorkspaceNavItem active={activeItem === "notes"}>My notes</WorkspaceNavItem>
        </Link>
        <WorkspaceNavItem active={activeItem === "shared"}>Shared notes</WorkspaceNavItem>
      </div>

      <div className="mt-3 border-t border-[var(--app-border-subtle)] pt-3">
        <WorkspaceNavItem active={activeItem === "trash"} muted>
          Trash
        </WorkspaceNavItem>
      </div>
    </nav>
  );
}
