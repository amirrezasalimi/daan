import type { Socks5ProxyConfig, TtsModelRef, TtsServiceConfig } from "@daan/api/config/schema";
import { Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { Plus } from "lucide-react";
import { useState } from "react";

import { TtsServiceCard } from "./tts-service-card";

interface NarrationServicesPanelProps {
  services: TtsServiceConfig[];
  proxy: Socks5ProxyConfig;
  defaultModel: TtsModelRef;
  onServicesChange: (services: TtsServiceConfig[]) => void;
  onDefaultModelChange: (model: TtsModelRef) => void;
}

function emptyService(): TtsServiceConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    provider: "openai-compatible",
    endpoint: "https://api.openai.com/v1",
    apiKey: "",
    models: [],
  };
}

function toDefaultValue(model: TtsModelRef) {
  if (!model.service || !model.model || !model.voice) return null;
  return `${model.service}::${model.model}::${model.voice}`;
}

function fromDefaultValue(value: string | null): TtsModelRef {
  if (!value) return { service: "", model: "", voice: "" };
  const [service = "", model = "", voice = ""] = value.split("::");
  return { service, model, voice };
}

export function NarrationServicesPanel({
  services,
  proxy,
  defaultModel,
  onServicesChange,
  onDefaultModelChange,
}: NarrationServicesPanelProps) {
  const [serviceToDelete, setServiceToDelete] = useState<TtsServiceConfig | null>(null);
  const defaultOptions = services.flatMap((service) =>
    service.models.flatMap((model) => {
      const voices = model.voices.length > 0 ? model.voices : [model.id];
      return voices.map((voice) => ({
        value: `${service.id}::${model.id}::${voice}`,
        label: `${service.name || "Service"} · ${model.name || model.id} · ${voice}`,
      }));
    }),
  );

  const confirmDelete = () => {
    if (!serviceToDelete) return;
    onServicesChange(services.filter((service) => service.id !== serviceToDelete.id));
    if (defaultModel.service === serviceToDelete.id) {
      onDefaultModelChange({ service: "", model: "", voice: "" });
    }
    setServiceToDelete(null);
  };

  return (
    <>
      <Modal
        opened={serviceToDelete != null}
        onClose={() => setServiceToDelete(null)}
        title="Delete narration service?"
        size="sm"
        radius="lg"
        centered
      >
        <Text size="sm" c="var(--app-text-muted)">
          This removes “{serviceToDelete?.name || "Untitled service"}” and its configured voices.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => setServiceToDelete(null)}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} className="!bg-[var(--app-danger)]">
            Delete service
          </Button>
        </Group>
      </Modal>

      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={600} c="var(--app-text)">
              Narration models
            </Text>
            <Text size="xs" c="var(--app-text-muted)">
              Configure OpenAI-compatible or Deepgram text-to-speech providers.
            </Text>
          </div>
          <Button
            size="xs"
            variant="light"
            leftSection={<Plus size={14} />}
            onClick={() => onServicesChange([...services, emptyService()])}
          >
            Add service
          </Button>
        </Group>

        <Select
          label="Default narration voice"
          description="Used when generating speech for a chapter."
          placeholder="Select a model and voice"
          searchable
          clearable
          data={defaultOptions}
          value={toDefaultValue(defaultModel)}
          nothingFoundMessage="Add a narration model first"
          onChange={(value) => onDefaultModelChange(fromDefaultValue(value))}
        />

        {services.length === 0 ? (
          <Text size="sm" c="var(--app-text-subtle)" ta="center" py="lg">
            No narration services configured yet.
          </Text>
        ) : null}

        {services.map((service, index) => (
          <TtsServiceCard
            key={service.id}
            service={service}
            proxy={proxy}
            index={index}
            onChange={(patch) =>
              onServicesChange(
                services.map((item) => (item.id === service.id ? { ...item, ...patch } : item)),
              )
            }
            onRemove={() => setServiceToDelete(service)}
          />
        ))}
      </Stack>
    </>
  );
}
