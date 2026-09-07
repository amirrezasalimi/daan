import { useEffect, useRef, useState } from "react";

export function useNarrationAudio(volume: number, playbackSpeed: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const instance = new Audio();
    audioRef.current = instance;
    setAudio(instance);
    return () => {
      instance.pause();
      instance.removeAttribute("src");
      instance.load();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audio) return;
    audio.volume = volume;
  }, [audio, volume]);

  useEffect(() => {
    if (!audio) return;
    audio.defaultPlaybackRate = playbackSpeed;
    audio.playbackRate = playbackSpeed;
    audio.preservesPitch = true;
  }, [audio, playbackSpeed]);

  return { audio, audioRef };
}
