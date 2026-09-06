import type { LlmServiceConfig, ModelConfig } from "@daan/api/config/schema";
import {
  ActionIcon,
  Button,
  Checkbox,
  Divider,
  Group,
  PasswordInput,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  ChevronDown,
  ChevronUp,
  DownloadCloud,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useListModels } from "../hooks/use-settings";

interface ServiceCardProps {
  service: LlmServiceConfig;
  index: number;
  onChange: (patch: Partial<LlmServiceConfig>) => void;
  onRemove: () => void;
}

const INITIAL_MODEL_COUNT = 5;
const MODEL_LIST_MAX_HEIGHT = 420;

function emptyModel(): ModelConfig {
  return { name: "", id: "", supportTools: false, supportVision: false };
}

export function ServiceCard({
  service,
  index,
  onChange,
  onRemove,
}: ServiceCardProps) {
  const listModels = useListModels();
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
  const visibleModels = normalizedQuery || showAllModels
    ? filteredModels
    : filteredModels.slice(0, INITIAL_MODEL_COUNT);

  const updateModel = (modelIndex: number, patch: Partial<ModelConfig>) => {
    onChange({
      models: service.models.map((m, i) =>
        i === modelIndex ? { ...m, ...patch } : m,
      ),
    });
  };

  const handleLoadModels = () => {
    if (!service.endpoint) {
      toast.error("Set an endpoint first");
      return;
    }

    listModels.mutate(
      { endpoint: service.endpoint, apiKey: service.apiKey },
      {
        onSuccess: ({ models }) => {
          const existing = new Set(service.models.map((m) => m.id));
          const added = models
            .filter((id) => !existing.has(id))
            .map((id) => ({
              name: id,
              id,
              supportTools: false,
              supportVision: false,
            }));

          if (added.length === 0) {
            toast.info("No new models found");
            return;
          }

          onChange({ models: [...service.models, ...added] });
          toast.success(`Loaded ${added.length} model(s)`);
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-muted)] p-4">
      <Group justify="space-between" align="flex-start" mb="sm">
        <Text size="sm" fw={600} c="var(--app-text)">
          {service.name || `Service ${index + 1}`}
        </Text>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label="Remove service"
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </ActionIcon>
      </Group>

      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Name"
            placeholder="OpenAI"
            value={service.name}
            onChange={(e) => onChange({ name: e.currentTarget.value })}
          />
          <TextInput
            label="Endpoint"
            placeholder="https://api.openai.com/v1"
            value={service.endpoint}
            onChange={(e) => onChange({ endpoint: e.currentTarget.value })}
          />
        </Group>
        <PasswordInput
          label="API key"
          placeholder="sk-..."
          value={service.apiKey}
          onChange={(e) => onChange({ apiKey: e.currentTarget.value })}
        />

        <Divider
          label="Models"
          labelPosition="left"
          c="var(--app-text-muted)"
        />

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

        <ScrollArea.Autosize
          mah={MODEL_LIST_MAX_HEIGHT}
          type="auto"
          offsetScrollbars="y"
        >
          <Stack gap="sm" pr="xs">
            {normalizedQuery && visibleModels.length === 0 ? (
              <Text size="sm" c="var(--app-text-subtle)" ta="center" py="md">
                No matching models.
              </Text>
            ) : null}
            {visibleModels.map(({ model, modelIndex }) => (
              <div
                key={`${model.id}-${modelIndex}`}
                className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface)] p-3"
              >
            <Group grow mb="xs">
              <TextInput
                size="xs"
                label="Display name"
                placeholder="GPT-4o"
                value={model.name}
                onChange={(e) =>
                  updateModel(modelIndex, { name: e.currentTarget.value })
                }
              />
              <TextInput
                size="xs"
                label="Model id"
                placeholder="gpt-4o"
                value={model.id}
                onChange={(e) =>
                  updateModel(modelIndex, { id: e.currentTarget.value })
                }
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

        <Group gap="xs">
          <Button
            size="xs"
            variant="subtle"
            color="brand"
            leftSection={<Plus size={14} />}
            onClick={() =>
              onChange({ models: [...service.models, emptyModel()] })
            }
          >
            Add model
          </Button>
          <Button
            size="xs"
            variant="light"
            color="brand"
            leftSection={<DownloadCloud size={14} />}
            loading={listModels.isPending}
            onClick={handleLoadModels}
          >
            Load models
          </Button>
        </Group>
      </Stack>
    </div>
  );
}
