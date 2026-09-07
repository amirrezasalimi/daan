import type { AppConfig } from "@daan/api/config/schema";

interface ReadyVoice {
  service: string;
  model: string;
  voice: string;
}

export function createNarrationModelOptions(
  services: AppConfig["ttsServices"],
  readyVoices: ReadyVoice[],
): Array<{ value: string; label: string }> {
  const readyVoiceKeys = new Set(
    readyVoices.map((entry) => `${entry.service}::${entry.model}::${entry.voice}`),
  );

  return services.flatMap((service) =>
    service.models.flatMap((model) =>
      (model.voices.length ? model.voices : [model.id]).map((voice) => {
        const key = `${service.id}::${model.id}::${voice}`;
        const modelName = model.name || model.id;
        const parts = [
          service.name || "Service",
          ...(modelName === voice ? [voice] : [modelName, voice]),
        ];
        if (readyVoiceKeys.has(key)) parts.push("[voice ready]");
        return { value: key, label: parts.join(" · ") };
      }),
    ),
  );
}
