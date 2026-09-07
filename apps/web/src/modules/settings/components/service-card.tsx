import type { LlmServiceConfig } from "@daan/api/config/schema";
import { ActionIcon, Button, Group, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { ChevronDown, ChevronRight, DownloadCloud, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useListModels } from "../hooks/use-settings";
import { LlmModelList } from "./llm-model-list";

interface ServiceCardProps {
  service: LlmServiceConfig;
  index: number;
  onChange: (patch: Partial<LlmServiceConfig>) => void;
  onRemove: () => void;
}

export function ServiceCard({ service, index, onChange, onRemove }: ServiceCardProps) {
  const listModels = useListModels();
  const [modelsExpanded, setModelsExpanded] = useState(false);

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
          setModelsExpanded(true);
          toast.success(`Loaded ${added.length} model(s)`);
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
      <Group justify="space-between" align="flex-start" mb="sm">
        <Text size="sm" fw={600} c="var(--app-text)">
          {service.name || `Service ${index + 1}`}
        </Text>
        <ActionIcon variant="subtle" color="red" aria-label="Remove service" onClick={onRemove}>
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
                Models
              </Text>
              <Text size="xs" c="var(--app-text-subtle)">
                {service.models.length} model{service.models.length === 1 ? "" : "s"}
              </Text>
            </div>
          </Group>
          <Button
            size="compact-xs"
            variant="light"
            color="brand"
            leftSection={<DownloadCloud size={14} />}
            loading={listModels.isPending}
            onClick={(event) => {
              event.stopPropagation();
              handleLoadModels();
            }}
          >
            Load models
          </Button>
        </Group>

        <LlmModelList service={service} expanded={modelsExpanded} onChange={onChange} />
      </Stack>
    </div>
  );
}
