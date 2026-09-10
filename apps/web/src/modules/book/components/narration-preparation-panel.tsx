import type {
  AppConfig,
  ModelRef,
  NarrationPreparationConfig,
  TtsModelRef,
} from "@daan/api/config/schema";
import { NARRATE_STYLES, NARRATION_PREPARATION_QUALITIES } from "@daan/api/config/schema";
import {
  Accordion,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Progress,
  Select,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { Loader2, RefreshCcw, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { useNarrationPreparation } from "../hooks/use-narration-preparation";

interface NarrationPreparationPanelProps {
  chapterId: string;
  narrationSelection: TtsModelRef;
  startIndex: number;
}

type PreparationPatch = Partial<NarrationPreparationConfig> & {
  narrateStyle?: AppConfig["narrateStyle"];
};

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function modelValue(model: ModelRef): string | null {
  return model.service && model.model ? `${model.service}::${model.model}` : null;
}

export function NarrationPreparationPanel({
  chapterId,
  narrationSelection,
  startIndex,
}: NarrationPreparationPanelProps) {
  const preparation = useNarrationPreparation(chapterId, narrationSelection);
  const [resetOpened, setResetOpened] = useState(false);
  const config = preparation.preparation;
  const stats = preparation.state?.stats;
  const latestStatus = preparation.latestRun?.status ?? "idle";
  const completed = stats?.ready ?? 0;
  const progress = stats?.total ? (completed / stats.total) * 100 : 0;
  const save = (patch: PreparationPatch) => preparation.updatePreparation(patch);
  const statusColor = latestStatus === "failed" ? "red" : preparation.isBusy ? "brand" : "gray";

  return (
    <section className="border-b border-[var(--app-border-subtle)] px-4 py-3 sm:px-5">
      <Modal
        opened={resetOpened}
        onClose={() => setResetOpened(false)}
        title="Reset prepared narration?"
        centered
        radius="lg"
        size="sm"
      >
        <Text size="sm" c="var(--app-text-muted)">
          This removes all prepared text and all generated chapter audio for every voice. This
          cannot be undone.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => setResetOpened(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={preparation.resetPending}
            onClick={() => {
              preparation.reset();
              setResetOpened(false);
            }}
          >
            Reset chapter
          </Button>
        </Group>
      </Modal>

      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Group gap={7} wrap="nowrap" className="min-w-0">
          <Sparkles size={15} className="shrink-0 text-[var(--app-accent)]" aria-hidden="true" />
          <div className="min-w-0">
            <Text size="xs" fw={650} c="var(--app-text)">
              Reader preparation
            </Text>
            <Text size="xs" c="var(--app-text-subtle)" truncate>
              {preparation.provenance
                ? `${preparation.provenance.providerId} · ${preparation.provenance.model}`
                : "No prepared text yet"}
            </Text>
          </div>
        </Group>
        <Group gap={6} wrap="nowrap">
          {preparation.activeWorkerCount > 0 ? (
            <Badge
              size="xs"
              variant="light"
              color="brand"
              leftSection={<Loader2 size={10} className="animate-spin" />}
            >
              {preparation.activeWorkerCount} active
            </Badge>
          ) : (
            <Badge size="xs" variant="light" color={statusColor}>
              {latestStatus}
            </Badge>
          )}
          <Switch
            size="xs"
            checked={config?.enabled ?? false}
            disabled={!config || preparation.settingsPending}
            aria-label="Enable reader narration preparation"
            onChange={(event) => save({ enabled: event.currentTarget.checked })}
          />
        </Group>
      </Group>

      <div className="mt-3">
        <Group justify="space-between" gap="xs" mb={5}>
          <Text size="xs" c="var(--app-text-muted)" className="tabular-nums">
            {stats
              ? `${stats.ready} ready · ${stats.omitted} omitted · ${stats.unprocessed} unprocessed`
              : "Loading preparation state…"}
          </Text>
          <Text size="xs" c="var(--app-text-subtle)" className="tabular-nums">
            {completed}/{stats?.total ?? 0} ready
          </Text>
        </Group>
        <Progress
          value={progress}
          size="xs"
          radius="xl"
          animated={preparation.isBusy}
          aria-label="Narration preparation progress"
        />
      </div>

      {preparation.errors.map((error) => (
        <Text key={error} size="xs" c="var(--app-danger)" mt={6} lineClamp={2}>
          {error}
        </Text>
      ))}
      {preparation.stateError ? (
        <Text size="xs" c="var(--app-danger)" mt={6} lineClamp={2}>
          {preparation.stateError}
        </Text>
      ) : null}

      <Group gap="xs" mt="sm" grow>
        <Button
          size="xs"
          variant="light"
          leftSection={<Sparkles size={13} />}
          loading={preparation.isBusy}
          disabled={!config?.enabled}
          onClick={() => preparation.prepare(startIndex)}
        >
          Prepare next
        </Button>
        <Button
          size="xs"
          variant="default"
          leftSection={<RefreshCcw size={13} />}
          loading={preparation.isBusy}
          disabled={!config?.enabled}
          onClick={() => preparation.prepare(startIndex, true)}
        >
          Retry / force
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="red"
          aria-label="Reset prepared narration and chapter audio"
          leftSection={<RotateCcw size={13} />}
          onClick={() => setResetOpened(true)}
        >
          Reset
        </Button>
      </Group>

      {config ? (
        <Accordion variant="contained" radius="md" mt="sm" order={3}>
          <Accordion.Item value="controls">
            <Accordion.Control aria-label="Open narration preparation controls">
              <Text size="xs" fw={600}>
                Quick controls
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  size="xs"
                  label="Provider / model"
                  searchable
                  data={preparation.modelOptions}
                  value={modelValue(config.model)}
                  nothingFoundMessage="No models configured"
                  onChange={(value) => {
                    const [service = "", model = ""] = value?.split("::") ?? [];
                    save({ model: { service, model } });
                  }}
                  className="col-span-2"
                />
                <Select
                  size="xs"
                  label="Style"
                  allowDeselect={false}
                  data={NARRATE_STYLES.map((value) => ({ value, label: label(value) }))}
                  value={preparation.style}
                  onChange={(value) =>
                    value && save({ narrateStyle: value as AppConfig["narrateStyle"] })
                  }
                />
                <Select
                  size="xs"
                  label="Quality"
                  allowDeselect={false}
                  data={NARRATION_PREPARATION_QUALITIES.map((value) => ({
                    value,
                    label: label(value),
                  }))}
                  value={config.quality}
                  onChange={(value) =>
                    value && save({ quality: value as NarrationPreparationConfig["quality"] })
                  }
                />
                <TextInput
                  size="xs"
                  label="Target language"
                  placeholder="None — preserve language"
                  value={config.targetLanguage}
                  onChange={(event) => save({ targetLanguage: event.currentTarget.value })}
                />
                <NumberInput
                  size="xs"
                  label="Prepare next"
                  suffix=" items"
                  min={1}
                  max={100}
                  allowDecimal={false}
                  allowNegative={false}
                  value={config.maxNextItems}
                  onChange={(value) => typeof value === "number" && save({ maxNextItems: value })}
                />
              </div>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ) : null}
    </section>
  );
}
