import type { ComponentProps } from "react";

import { NarrationPlayer } from "./narration-player";
import { NarrationPreparationPanel } from "./narration-preparation-panel";

interface NarrationDockProps {
  chapterId: string;
  preparationStartIndex: number;
  player: ComponentProps<typeof NarrationPlayer>;
}

export function NarrationDock({ chapterId, preparationStartIndex, player }: NarrationDockProps) {
  return (
    <aside
      aria-label="Narration controls"
      className="absolute inset-x-4 bottom-4 z-20 flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-md sm:right-6 sm:left-auto sm:bottom-6 sm:max-h-[calc(100%-3rem)] sm:w-[min(25rem,calc(100%-3rem))]"
    >
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <NarrationPreparationPanel
          chapterId={chapterId}
          narrationSelection={player.selection}
          startIndex={preparationStartIndex}
        />
        <NarrationPlayer {...player} />
      </div>
    </aside>
  );
}
