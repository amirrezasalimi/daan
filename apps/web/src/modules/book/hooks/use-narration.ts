import type { TtsModelRef } from "@daan/api/config/schema";
import type { AppRouter } from "@daan/api/routers/index";
import { useLocalStorage } from "@mantine/hooks";
import type { InferRouterOutputs } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { client, getApiAssetUrl, orpc } from "@/shared/utils/orpc";

import { useSettingsQuery } from "@/modules/settings";

import { createNarrationModelOptions } from "../utils/narration-model-options";
import { DEFAULT_SAVED_NARRATION_STATE, type SavedNarrationState } from "../utils/narration-state";
import { useBrowserNarration } from "./use-browser-narration";
import { useNarrationAudio } from "./use-narration-audio";

type RouterOutputs = InferRouterOutputs<AppRouter>;
export type NarrationSegment = RouterOutputs["narration"]["getSegments"][number];

function hasSelection(selection: TtsModelRef): boolean {
  return Boolean(selection.service && selection.model && selection.voice);
}

export function useNarration(bookId: string | null, chapterId: string | null) {
  const bookKey = bookId ?? "none";
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const browserNarration = useBrowserNarration();
  const [selection, setSelection] = useState<TtsModelRef>({ service: "", model: "", voice: "" });
  const [wantsPlayback, setWantsPlayback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useLocalStorage({ key: "daan:narration-volume", defaultValue: 0.8 });
  const [playbackSpeed, setPlaybackSpeed] = useLocalStorage({
    key: "daan:narration-speed",
    defaultValue: 1,
  });
  const { audio, audioRef } = useNarrationAudio(volume, playbackSpeed);
  const [opened, setOpened] = useLocalStorage({
    key: `daan:narration-open:${bookKey}`,
    defaultValue: false,
  });
  const [savedState, setSavedState] = useLocalStorage<SavedNarrationState>({
    key: `daan:narration-state:${bookKey}`,
    defaultValue: DEFAULT_SAVED_NARRATION_STATE,
  });

  const restoresForChapter = savedState.chapterId === chapterId;
  const [activeIndex, setActiveIndexState] = useState(restoresForChapter ? savedState.index : 0);
  const [progress, setProgressState] = useState(restoresForChapter ? savedState.progress : 0);
  const pendingSeekRef = useRef<number | null>(restoresForChapter ? savedState.progress : null);

  const setActiveIndex = useCallback(
    (index: number) => {
      setActiveIndexState(index);
      setProgressState(0);
      pendingSeekRef.current = null;
      setSavedState({ chapterId, index, progress: 0 });
    },
    [chapterId, setSavedState],
  );

  const setProgress = useCallback(
    (value: number) => {
      setProgressState(value);
      setSavedState((current) => ({ ...current, chapterId, progress: value }));
    },
    [chapterId, setSavedState],
  );

  useEffect(() => {
    if (!settings) return;
    const valid = settings.ttsServices.some(
      (service) =>
        service.id === selection.service &&
        service.models.some(
          (model) =>
            model.id === selection.model &&
            (model.voices.length === 0 || model.voices.includes(selection.voice)),
        ),
    );
    if (!valid) setSelection(settings.defaultTtsModel);
  }, [selection, settings]);

  const prevChapterIdRef = useRef(chapterId);
  useEffect(() => {
    if (prevChapterIdRef.current === chapterId) return;
    prevChapterIdRef.current = chapterId;
    audioRef.current?.pause();
    setWantsPlayback(false);
    const restored = savedState.chapterId === chapterId;
    const restoredIndex = restored ? savedState.index : 0;
    const restoredProgress = restored ? savedState.progress : 0;
    setActiveIndexState(restoredIndex);
    setProgressState(restoredProgress);
    pendingSeekRef.current = restoredProgress || null;
    if (!restored) setSavedState({ chapterId, index: 0, progress: 0 });
  }, [chapterId, savedState, setSavedState]);

  useEffect(() => {
    if (opened) return;
    audioRef.current?.pause();
    setWantsPlayback(false);
  }, [opened]);

  const queryInput = { chapterId: chapterId ?? "", selection };
  const segmentsQuery = useQuery({
    ...orpc.narration.getSegments.queryOptions({ input: queryInput }),
    enabled: opened && Boolean(chapterId) && hasSelection(selection),
    refetchInterval: (query) =>
      query.state.data?.some((segment) => ["pending", "processing"].includes(segment.status))
        ? 1000
        : false,
  });

  const narrationCountQuery = useQuery({
    ...orpc.narration.countChapterNarrations.queryOptions({
      input: { chapterId: chapterId ?? "" },
    }),
    enabled: opened && Boolean(chapterId),
  });

  const activeWorkerCountQuery = useQuery({
    ...orpc.narration.getActiveWorkerCount.queryOptions({ input: undefined }),
    enabled: opened,
    refetchInterval: opened ? 1500 : false,
  });

  const readyVoicesQuery = useQuery({
    ...orpc.narration.getReadyVoices.queryOptions({ input: undefined }),
    enabled: opened,
  });

  const selectedService = settings?.ttsServices.find((service) => service.id === selection.service);
  const isBrowserProvider = selectedService?.provider === "browser-local";

  const generate = useMutation({
    mutationFn: (input: { startIndex: number; force: boolean; count?: number }) =>
      client.narration.generate({
        chapterId: chapterId ?? "",
        startIndex: input.startIndex,
        count: input.count ?? 1 + (settings?.narrateAheadCount ?? 3),
        selection,
        force: input.force,
      }),
    onSuccess: (segments) => {
      void narrationCountQuery.refetch();
      queryClient.setQueryData(
        orpc.narration.getSegments.queryKey({ input: queryInput }),
        segments,
      );
      if (isBrowserProvider && chapterId) {
        void browserNarration.process(chapterId, selection, () => {
          void segmentsQuery.refetch();
        });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Could not generate narration"),
  });

  const reset = useMutation({
    mutationFn: () => client.narration.reset({ chapterId: chapterId ?? "" }),
    onSuccess: () => {
      audioRef.current?.pause();
      setWantsPlayback(false);
      setActiveIndex(0);
      void segmentsQuery.refetch();
      void narrationCountQuery.refetch();
    },
  });

  const segments = segmentsQuery.data ?? [];
  const activeSegment = segments[activeIndex] ?? null;

  const playIndex = useCallback(
    (index: number) => {
      if (!segments[index]) return;
      setActiveIndex(index);
      setWantsPlayback(true);
      generate.mutate({ startIndex: index, force: false });
    },
    [generate, segments, setActiveIndex],
  );

  useEffect(() => {
    if (!audio || !wantsPlayback || !activeSegment?.audioUrl) return;
    audio.defaultPlaybackRate = playbackSpeed;
    audio.playbackRate = playbackSpeed;
    audio.preservesPitch = true;
    const source = getApiAssetUrl(activeSegment.audioUrl);
    if (audio.src !== source) {
      audio.src = source;
      const seekTo = pendingSeekRef.current;
      pendingSeekRef.current = null;
      audio.currentTime = seekTo ?? 0;
      setProgressState(seekTo ?? 0);
      setDuration(0);
    }
    void audio.play().catch(() => {
      setWantsPlayback(false);
      toast.error("Could not play narration audio");
    });
  }, [activeSegment?.audioUrl, audio, playbackSpeed, wantsPlayback]);

  useEffect(() => {
    if (!audio) return;
    const update = () => {
      setProgress(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const ended = () => {
      setIsPlaying(false);
      if (activeIndex + 1 < segments.length) playIndex(activeIndex + 1);
      else setWantsPlayback(false);
    };
    const playing = () => setIsPlaying(true);
    const paused = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("durationchange", update);
    audio.addEventListener("ended", ended);
    audio.addEventListener("play", playing);
    audio.addEventListener("pause", paused);
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("durationchange", update);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("play", playing);
      audio.removeEventListener("pause", paused);
    };
  }, [activeIndex, audio, playIndex, segments.length, setProgress]);

  const togglePlayback = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setWantsPlayback(false);
    } else if (activeSegment?.status === "ready") {
      setWantsPlayback(true);
    } else {
      playIndex(activeIndex);
    }
  };

  const seek = (seconds: number) => {
    const currentAudio = audioRef.current;
    if (!currentAudio || !Number.isFinite(currentAudio.duration)) return;
    const nextTime = Math.min(Math.max(seconds, 0), currentAudio.duration);
    currentAudio.currentTime = nextTime;
    setProgress(nextTime);
  };

  const modelOptions = useMemo(
    () => createNarrationModelOptions(settings?.ttsServices ?? [], readyVoicesQuery.data ?? []),
    [readyVoicesQuery.data, settings?.ttsServices],
  );

  const changeModel = (value: string | null) => {
    const [service = "", model = "", voice = ""] = value?.split("::") ?? [];
    const currentAudio = audioRef.current;
    currentAudio?.pause();
    currentAudio?.removeAttribute("src");
    currentAudio?.load();
    setIsPlaying(false);
    setWantsPlayback(false);
    setDuration(0);
    setProgressState(0);
    pendingSeekRef.current = null;
    setSelection({ service, model, voice });
  };

  return {
    activeIndex,
    activeSegment,
    activeWorkerCount: activeWorkerCountQuery.data ?? 0,
    cachedNarrationCount: narrationCountQuery.data ?? 0,
    changeModel,
    duration,
    browserLoadProgress: browserNarration.loadProgress,
    browserStatus: browserNarration.status,
    generatePending: generate.isPending || browserNarration.active,
    isPlaying,
    modelOptions,
    opened,
    playIndex,
    playbackSpeed,
    progress,
    regenerate: () => generate.mutate({ startIndex: activeIndex, force: true, count: 1 }),
    reset: () => reset.mutate(),
    resetPending: reset.isPending,
    seek,
    segments,
    selection,
    setOpened,
    setPlaybackSpeed,
    setVolume,
    togglePlayback,
    volume,
  };
}
