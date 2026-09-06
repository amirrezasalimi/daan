import type { Socks5ProxyConfig, TtsModelConfig, TtsServiceConfig } from "@daan/api/config/schema";
import {
  ActionIcon,
  Button,
  Group,
  PasswordInput,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { DownloadCloud, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useListDeepgramVoices } from "../hooks/use-settings";

interface TtsServiceCardProps {
  service: TtsServiceConfig;
  proxy: Socks5ProxyConfig;
  index: number;
  onChange: (patch: Partial<TtsServiceConfig>) => void;
  onRemove: () => void;
}

function emptyModel(): TtsModelConfig {
  return { name: "", id: "", voices: [] };
}

export function TtsServiceCard({ service, proxy, index, onChange, onRemove }: TtsServiceCardProps) {
  const listDeepgramVoices = useListDeepgramVoices();

  const updateModel = (modelIndex: number, patch: Partial<TtsModelConfig>) => {
    onChange({
      models: service.models.map((model, currentIndex) =>
        currentIndex === modelIndex ? { ...model, ...patch } : model,
      ),
    });
  };

  const loadDeepgramVoices = () => {
    listDeepgramVoices.mutate(proxy, {
      onSuccess: ({ voices }) => {
        onChange({
          models: voices.map((voice) => ({ name: voice, id: voice, voices: [voice] })),
        });
        toast.success(`Loaded ${voices.length} Deepgram voices`);
      },
    });
  };

  return (
    <section className="border-b border-[var(--app-border-subtle)] pb-6 last:border-b-0 last:pb-0">
      <Group justify="space-between" align="center" mb="md">
        <div>
          <Text fw={600} c="var(--app-text)">
            {service.name || `Narration service ${index + 1}`}
          </Text>
          <Text size="xs" c="var(--app-text-muted)">
            {service.provider === "deepgram" ? "Deepgram Aura" : "OpenAI-compatible TTS"}
          </Text>
        </div>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label="Remove narration service"
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </ActionIcon>
      </Group>

      <Stack gap="sm">
        <Group grow align="flex-start">
          <TextInput
            label="Name"
            placeholder="Narration provider"
            value={service.name}
            onChange={(event) => onChange({ name: event.currentTarget.value })}
          />
          <Select
            label="Provider"
            allowDeselect={false}
            value={service.provider}
            data={[
              { value: "openai-compatible", label: "OpenAI-compatible" },
              { value: "deepgram", label: "Deepgram" },
            ]}
            onChange={(value) => {
              const provider = value === "deepgram" ? "deepgram" : "openai-compatible";
              onChange({
                provider,
                endpoint:
                  provider === "deepgram" ? "https://api.deepgram.com/v1" : service.endpoint,
              });
            }}
          />
        </Group>
        <TextInput
          label="Endpoint"
          value={service.endpoint}
          placeholder="https://api.openai.com/v1"
          onChange={(event) => onChange({ endpoint: event.currentTarget.value })}
        />
        <PasswordInput
          label="API key"
          value={service.apiKey}
          placeholder="Enter API key"
          onChange={(event) => onChange({ apiKey: event.currentTarget.value })}
        />

        <Group justify="space-between" mt="xs">
          <Text size="sm" fw={600} c="var(--app-text)">
            Models and voices
          </Text>
          {service.provider === "deepgram" ? (
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<DownloadCloud size={14} />}
              loading={listDeepgramVoices.isPending}
              onClick={loadDeepgramVoices}
            >
              Load current voices
            </Button>
          ) : (
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<Plus size={14} />}
              onClick={() => onChange({ models: [...service.models, emptyModel()] })}
            >
              Add model
            </Button>
          )}
        </Group>

        {service.models.length === 0 ? (
          <Text size="sm" c="var(--app-text-subtle)" py="xs">
            {service.provider === "deepgram"
              ? "Load Deepgram’s current supported voices."
              : "Add a TTS model and its supported voices."}
          </Text>
        ) : null}

        {service.models.map((model, modelIndex) => (
          <div
            key={`${model.id}-${modelIndex}`}
            className="rounded-lg border border-[var(--app-border-subtle)] p-4"
          >
            <Group grow align="flex-start">
              <TextInput
                size="xs"
                label="Display name"
                value={model.name}
                onChange={(event) => updateModel(modelIndex, { name: event.currentTarget.value })}
              />
              <TextInput
                size="xs"
                label="Model id"
                value={model.id}
                onChange={(event) => updateModel(modelIndex, { id: event.currentTarget.value })}
              />
              <ActionIcon
                mt={24}
                size="sm"
                variant="subtle"
                color="red"
                aria-label="Remove TTS model"
                onClick={() =>
                  onChange({
                    models: service.models.filter((_, currentIndex) => currentIndex !== modelIndex),
                  })
                }
              >
                <Trash2 size={14} />
              </ActionIcon>
            </Group>
            {service.provider === "openai-compatible" ? (
              <TagsInput
                mt="sm"
                size="xs"
                label="Voices"
                placeholder="Type a voice and press Enter"
                value={model.voices}
                onChange={(voices) => updateModel(modelIndex, { voices })}
              />
            ) : null}
          </div>
        ))}
      </Stack>
    </section>
  );
}
