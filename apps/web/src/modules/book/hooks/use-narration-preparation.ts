import type { AppConfig, NarrationPreparationConfig, TtsModelRef } from "@daan/api/config/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { client, orpc } from "@/shared/utils/orpc";

import { useSettingsQuery, useUpdateSettings } from "@/modules/settings";

const ACTIVE_STATUSES = new Set(["pending", "processing"]);

export function useNarrationPreparation(chapterId: string | null, narrationSelection: TtsModelRef) {
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const updateSettings = useUpdateSettings();

  const workerQuery = useQuery({
    ...orpc.narrationPreparation.getActiveWorkerCount.queryOptions({ input: undefined }),
    enabled: Boolean(chapterId),
    refetchInterval: chapterId ? 1_500 : false,
  });

  const chapterInput = { chapterId: chapterId ?? "" };
  const stateQuery = useQuery({
    ...orpc.narrationPreparation.getChapterState.queryOptions({ input: chapterInput }),
    enabled: Boolean(chapterId),
    refetchInterval: (query) => {
      const hasActiveRun = query.state.data?.runs.some((run) => ACTIVE_STATUSES.has(run.status));
      return hasActiveRun || (workerQuery.data ?? 0) > 0 ? 1_000 : false;
    },
  });

  const refreshNarration = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.narration.getSegments.queryKey({
        input: { chapterId: chapterId ?? "", selection: narrationSelection },
      }),
    });
  const queuedRunId = useRef<string | null>(null);

  const prepare = useMutation({
    mutationFn: (input: { startIndex: number; force: boolean }) =>
      client.narrationPreparation.prepare({ chapterId: chapterId ?? "", ...input }),
    onSuccess: ({ runId }) => {
      queuedRunId.current = runId;
      void stateQuery.refetch();
      if (runId) void refreshNarration();
      if (runId) toast.success("Narration preparation queued");
      else toast.info("This part of the chapter is already prepared");
    },
    onError: (error: Error) => toast.error(error.message || "Could not prepare narration"),
  });

  const reset = useMutation({
    mutationFn: () => client.narrationPreparation.resetChapter(chapterInput),
    onSuccess: () => {
      void stateQuery.refetch();
      void refreshNarration();
      queryClient.invalidateQueries({
        queryKey: orpc.narration.countChapterNarrations.queryKey({ input: chapterInput }),
      });
      toast.success("Prepared narration and chapter audio removed");
    },
    onError: (error: Error) => toast.error(error.message || "Could not reset preparation"),
  });

  const hasActiveRun =
    stateQuery.data?.runs.some((run) => ACTIVE_STATUSES.has(run.status)) ?? false;
  const wasActive = useRef(false);
  const latestRun = stateQuery.data?.runs[0] ?? null;
  useEffect(() => {
    const queuedRunFinished =
      queuedRunId.current === latestRun?.id && !ACTIVE_STATUSES.has(latestRun.status);
    if ((wasActive.current && !hasActiveRun) || queuedRunFinished) {
      void refreshNarration();
      if (queuedRunFinished) queuedRunId.current = null;
    }
    wasActive.current = hasActiveRun;
  }, [hasActiveRun, latestRun?.id, latestRun?.status, stateQuery.dataUpdatedAt]);
  const latestChunk = stateQuery.data?.chunks.at(-1) ?? null;
  const provenance = latestRun
    ? { providerId: latestRun.providerId, model: latestRun.model }
    : latestChunk
      ? { providerId: latestChunk.providerId, model: latestChunk.model }
      : null;
  const errors = useMemo(
    () =>
      (stateQuery.data?.runs ?? [])
        .filter((run) => run.status === "failed" && run.error)
        .slice(0, 2)
        .map((run) => run.error as string),
    [stateQuery.data?.runs],
  );

  const updatePreparation = (
    patch: Partial<NarrationPreparationConfig> & { narrateStyle?: AppConfig["narrateStyle"] },
  ) => {
    if (!settings) return;
    const { narrateStyle, ...preparationPatch } = patch;
    updateSettings.mutate({
      ...settings,
      narrateStyle: narrateStyle ?? settings.narrateStyle,
      narrationPreparation: { ...settings.narrationPreparation, ...preparationPatch },
    });
  };

  return {
    activeWorkerCount: workerQuery.data ?? 0,
    errors,
    isBusy: hasActiveRun || prepare.isPending || (workerQuery.data ?? 0) > 0,
    latestRun,
    modelOptions:
      settings?.llmServices.flatMap((service) =>
        service.models.map((model) => ({
          value: `${service.id}::${model.id}`,
          label: `${service.name || "Provider"} · ${model.name || model.id}`,
        })),
      ) ?? [],
    prepare: (startIndex: number, force = false) => prepare.mutate({ startIndex, force }),
    preparation: settings?.narrationPreparation ?? null,
    provenance,
    reset: () => reset.mutate(),
    resetPending: reset.isPending,
    settingsPending: updateSettings.isPending,
    state: stateQuery.data ?? null,
    stateError: stateQuery.error instanceof Error ? stateQuery.error.message : null,
    style: settings?.narrateStyle ?? "neutral",
    updatePreparation,
  };
}
