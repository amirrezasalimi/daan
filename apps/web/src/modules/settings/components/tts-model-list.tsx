import type { TtsModelConfig, TtsServiceConfig } from "@daan/api/config/schema";
import {
  ActionIcon,
  Button,
  Collapse,
  Group,
  ScrollArea,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { ChevronDown, ChevronUp, Search, Trash2, X } from "lucide-react";
import { useState } from "react";

import { VoicePreviewButton } from "./voice-preview-button";

const INITIAL_MODEL_COUNT = 5;
const MODEL_LIST_MAX_HEIGHT = 420;

interface TtsModelListProps {
  service: TtsServiceConfig;
  expanded: boolean;
  onUpdateModel: (modelIndex: number, patch: Partial<TtsModelConfig>) => void;
  onRemoveModel: (modelIndex: number) => void;
}

export function TtsModelList({
  service,
  expanded,
  onUpdateModel,
  onRemoveModel,
}: TtsModelListProps) {
  const [showAllModels, setShowAllModels] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const normalizedQuery = modelQuery.trim().toLocaleLowerCase();
  const indexedModels = service.models.map((model, modelIndex) => ({ model, modelIndex }));
  const filteredModels = normalizedQuery
    ? indexedModels.filter(({ model }) =>
        `${model.name} ${model.id} ${model.voices.join(" ")}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : indexedModels;
  const hasMoreModels = service.models.length > INITIAL_MODEL_COUNT;
  const visibleModels =
    normalizedQuery || showAllModels
      ? filteredModels
      : filteredModels.slice(0, INITIAL_MODEL_COUNT);

  return (
    <Collapse expanded={expanded}>
      <Stack gap="sm">
        {service.models.length === 0 ? (
          <Text size="sm" c="var(--app-text-subtle)" py="xs">
            {service.provider === "deepgram"
              ? "Load Deepgram’s current supported voices."
              : "Add a TTS model and its supported voices."}
          </Text>
        ) : null}

        {service.models.length > 0 ? (
          <TextInput
            size="xs"
            radius="xl"
            value={modelQuery}
            onChange={(event) => setModelQuery(event.currentTarget.value)}
            placeholder="Search models and voices"
            aria-label="Search models and voices"
            leftSection={<Search size={14} strokeWidth={1.6} />}
            rightSection={
              modelQuery ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label="Clear model search"
                  onClick={() => setModelQuery("")}
                >
                  <X size={13} strokeWidth={1.7} />
                </ActionIcon>
              ) : null
            }
            rightSectionPointerEvents={modelQuery ? "all" : "none"}
          />
        ) : null}

        <ScrollArea.Autosize mah={MODEL_LIST_MAX_HEIGHT} type="auto" offsetScrollbars="y">
          <Stack gap="sm" pr="xs">
            {normalizedQuery && visibleModels.length === 0 ? (
              <Text size="sm" c="var(--app-text-subtle)" ta="center" py="md">
                No matching models.
              </Text>
            ) : null}
            {visibleModels.map(({ model, modelIndex }) => (
              <div
                key={`${model.id}-${modelIndex}`}
                className="rounded-lg border border-[var(--app-border-subtle)] p-4"
              >
                <Group grow align="flex-start">
                  <TextInput
                    size="xs"
                    label="Display name"
                    value={model.name}
                    onChange={(event) =>
                      onUpdateModel(modelIndex, { name: event.currentTarget.value })
                    }
                  />
                  <TextInput
                    size="xs"
                    label="Model id"
                    value={model.id}
                    onChange={(event) =>
                      onUpdateModel(modelIndex, { id: event.currentTarget.value })
                    }
                  />
                  <VoicePreviewButton
                    provider={service.provider === "deepgram" ? "deepgram" : "openai-compatible"}
                    endpoint={service.endpoint}
                    apiKey={service.apiKey}
                    model={model.id}
                    voice={model.voices[0] ?? model.id}
                  />
                  <ActionIcon
                    mt={24}
                    size="sm"
                    variant="subtle"
                    color="red"
                    aria-label="Remove TTS model"
                    onClick={() => onRemoveModel(modelIndex)}
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
                    onChange={(voices) => onUpdateModel(modelIndex, { voices })}
                  />
                ) : null}
              </div>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        {hasMoreModels && !normalizedQuery ? (
          <Button
            size="compact-xs"
            variant="subtle"
            color="brand"
            rightSection={
              showAllModels ? (
                <ChevronUp size={14} strokeWidth={1.7} />
              ) : (
                <ChevronDown size={14} strokeWidth={1.7} />
              )
            }
            onClick={() => setShowAllModels((value) => !value)}
          >
            {showAllModels
              ? "Show fewer"
              : `Show ${service.models.length - INITIAL_MODEL_COUNT} more`}
          </Button>
        ) : null}
      </Stack>
    </Collapse>
  );
}
