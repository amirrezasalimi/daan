import type { Socks5ProxyConfig, TtsModelConfig, TtsServiceConfig } from "@daan/api/config/schema";
import {
  ActionIcon,
  Button,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { ChevronDown, ChevronRight, DownloadCloud, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useListDeepgramVoices } from "../hooks/use-settings";
import { BrowserTtsServiceCard } from "./browser-tts-service-card";
import { TtsModelList } from "./tts-model-list";

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
  const isBrowserLocal = service.provider === "browser-local";
  const [modelsExpanded, setModelsExpanded] = useState(false);

  if (isBrowserLocal) return <BrowserTtsServiceCard service={service} />;

  const updateModel = (modelIndex: number, patch: Partial<TtsModelConfig>) => {
    onChange({
      models: service.models.map((model, currentIndex) =>
        currentIndex === modelIndex ? { ...model, ...patch } : model,
      ),
    });
  };

  const removeModel = (modelIndex: number) => {
    onChange({
      models: service.models.filter((_, currentIndex) => currentIndex !== modelIndex),
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

        <Group
          justify="space-between"
          align="center"
          mt="xs"
          className="cursor-pointer select-none"
          onClick={() => setModelsExpanded((value) => !value)}
        >
          <Group gap={6}>
            <ActionIcon
              size="sm"
              variant="subtle"
              aria-label={modelsExpanded ? "Collapse models" : "Expand models"}
              onClick={(event) => {
                event.stopPropagation();
                setModelsExpanded((value) => !value);
              }}
            >
              {modelsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </ActionIcon>
            <div>
              <Text size="sm" fw={600} c="var(--app-text)">
                Models and voices
              </Text>
              <Text size="xs" c="var(--app-text-subtle)">
                {service.models.length} model{service.models.length === 1 ? "" : "s"}
              </Text>
            </div>
          </Group>
          {service.provider === "deepgram" ? (
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<DownloadCloud size={14} />}
              loading={listDeepgramVoices.isPending}
              onClick={(event) => {
                event.stopPropagation();
                loadDeepgramVoices();
              }}
            >
              Load current voices
            </Button>
          ) : (
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<Plus size={14} />}
              onClick={(event) => {
                event.stopPropagation();
                onChange({ models: [...service.models, emptyModel()] });
                setModelsExpanded(true);
              }}
            >
              Add model
            </Button>
          )}
        </Group>

        <TtsModelList
          service={service}
          expanded={modelsExpanded}
          onUpdateModel={updateModel}
          onRemoveModel={removeModel}
        />
      </Stack>
    </section>
  );
}
