import type { LlmServiceConfig } from "@daan/api/config/schema";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { Plus } from "lucide-react";
import { useState } from "react";

import { ServiceCard } from "./service-card";

interface LlmServicesPanelProps {
  services: LlmServiceConfig[];
  onChange: (services: LlmServiceConfig[]) => void;
}

function emptyService(): LlmServiceConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    endpoint: "",
    apiKey: "",
    models: [],
  };
}

export function LlmServicesPanel({ services, onChange }: LlmServicesPanelProps) {
  const [serviceToDelete, setServiceToDelete] = useState<LlmServiceConfig | null>(null);

  const confirmDelete = () => {
    if (!serviceToDelete) return;
    onChange(services.filter((service) => service.id !== serviceToDelete.id));
    setServiceToDelete(null);
  };

  return (
    <>
      <Modal
        opened={serviceToDelete != null}
        onClose={() => setServiceToDelete(null)}
        title="Delete LLM service?"
        size="sm"
        radius="lg"
        centered
      >
        <Text size="sm" c="var(--app-text-muted)">
          This will remove “{serviceToDelete?.name || "Untitled service"}” and all{" "}
          {serviceToDelete?.models.length ?? 0} configured models from your settings.
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

      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={600} c="var(--app-text)">
              LLM services
            </Text>
            <Text size="xs" c="var(--app-text-muted)">
              OpenAI-compatible providers and their available models.
            </Text>
          </div>
          <Button
            size="xs"
            variant="light"
            color="brand"
            leftSection={<Plus size={14} />}
            onClick={() => onChange([...services, emptyService()])}
          >
            Add service
          </Button>
        </Group>

        {services.length === 0 ? (
          <Text size="sm" c="var(--app-text-subtle)" ta="center" py="lg">
            No services configured yet.
          </Text>
        ) : null}

        {services.map((service, serviceIndex) => (
          <ServiceCard
            key={service.id}
            service={service}
            index={serviceIndex}
            onChange={(patch) =>
              onChange(
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
