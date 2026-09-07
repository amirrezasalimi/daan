export interface SavedNarrationState {
  chapterId: string | null;
  index: number;
  progress: number;
}

export const DEFAULT_SAVED_NARRATION_STATE: SavedNarrationState = {
  chapterId: null,
  index: 0,
  progress: 0,
};
