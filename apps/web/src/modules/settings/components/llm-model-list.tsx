import type { LlmServiceConfig, ModelConfig } from "@daan/api/config/schema";
import {
  ActionIcon,
  Button,
  Checkbox,
  Collapse,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { ChevronDown, ChevronUp, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";

const INITIAL_MODEL_COUNT = 5;
const MODEL_LIST_MAX_HEIGHT = 420;

function emptyModel(): ModelConfig {
  return { name: "", id: "", supportTools: false, supportVision: false };
}

interface LlmModelListProps {
  service: LlmServiceConfig;
  expanded: boolean;
  onChange: (patch: Partial<LlmServiceConfig>) => void;
}

export function LlmModelList({ service, expanded, onChange }: LlmModelListProps) {
  const [showAllModels, setShowAllModels] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const normalizedQuery = modelQuery.trim().toLocaleLowerCase();
  const indexedModels = service.models.map((model, modelIndex) => ({
    model,
    modelIndex,
  }));
  const filteredModels = normalizedQuery
    ? indexedModels.filter(({ model }) =>
        `${model.name} ${model.id}`.toLocaleLowerCase().includes(normalizedQuery),
      )
    : indexedModels;
  const hasMoreModels = service.models.length > INITIAL_MODEL_COUNT;
  const visibleModels =
    normalizedQuery || showAllModels
      ? filteredModels
      : filteredModels.slice(0, INITIAL_MODEL_COUNT);

  const updateModel = (modelIndex: number, patch: Partial<ModelConfig>) => {
    onChange({
      models: service.models.map((m, i) => (i === modelIndex ? { ...m, ...patch } : m)),
    });
  };

  return (
    <Collapse expanded={expanded}>
      <Stack gap="sm">
        {service.models.length > 0 ? (
          <TextInput
            size="xs"
            radius="xl"
            value={modelQuery}
            onChange={(event) => setModelQuery(event.currentTarget.value)}
            placeholder="Search models"
            aria-label="Search models by name or id"
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
                className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-raised)] p-3"
              >
                <Group grow mb="xs">
                  <TextInput
                    size="xs"
                    label="Display name"
                    placeholder="GPT-4o"
                    value={model.name}
                    onChange={(e) => updateModel(modelIndex, { name: e.currentTarget.value })}
                  />
                  <TextInput
                    size="xs"
                    label="Model id"
                    placeholder="gpt-4o"
                    value={model.id}
                    onChange={(e) => updateModel(modelIndex, { id: e.currentTarget.value })}
                  />
                </Group>
                <Group justify="space-between" align="center">
                  <Group gap="lg">
                    <Checkbox
                      size="xs"
                      label="Tools"
                      checked={model.supportTools}
                      onChange={(e) =>
                        updateModel(modelIndex, {
                          supportTools: e.currentTarget.checked,
                        })
                      }
                    />
                    <Checkbox
                      size="xs"
                      label="Vision"
                      checked={model.supportVision}
                      onChange={(e) =>
                        updateModel(modelIndex, {
                          supportVision: e.currentTarget.checked,
                        })
                      }
                    />
                  </Group>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    aria-label="Remove model"
                    onClick={() =>
                      onChange({
                        models: service.models.filter((_, i) => i !== modelIndex),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </ActionIcon>
                </Group>
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

        <Button
          size="xs"
          variant="subtle"
          color="brand"
          leftSection={<Plus size={14} />}
          onClick={() => onChange({ models: [...service.models, emptyModel()] })}
        >
          Add model
        </Button>
      </Stack>
    </Collapse>
  );
}
