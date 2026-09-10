import type {
  AppConfig,
  ModelRef,
  NarrationPreparationConfig,
  NarrationPreparationQuality,
  NarrateStyle,
} from "@daan/api/config/schema";
import { NARRATION_PREPARATION_QUALITIES, NARRATE_STYLES } from "@daan/api/config/schema";
import {
  Accordion,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";

interface NarrationPreparationSettingsProps {
  llmServices: AppConfig["llmServices"];
  narrateWithAI: AppConfig["narrateWithAI"];
  narrateAheadCount: AppConfig["narrateAheadCount"];
  narrateStyle: AppConfig["narrateStyle"];
  preparation: AppConfig["narrationPreparation"];
  onNarrateWithAIChange: (value: AppConfig["narrateWithAI"]) => void;
  onNarrateAheadCountChange: (value: AppConfig["narrateAheadCount"]) => void;
  onNarrateStyleChange: (value: AppConfig["narrateStyle"]) => void;
  onPreparationChange: (value: AppConfig["narrationPreparation"]) => void;
}

function toModelValue(model: ModelRef): string | null {
  return model.service && model.model ? `${model.service}::${model.model}` : null;
}

function fromModelValue(value: string | null): ModelRef {
  if (!value) return { service: "", model: "" };
  const [service = "", model = ""] = value.split("::");
  return { service, model };
}

function labelFromValue(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function NarrationPreparationSettings({
  llmServices,
  narrateWithAI,
  narrateAheadCount,
  narrateStyle,
  preparation,
  onNarrateWithAIChange,
  onNarrateAheadCountChange,
  onNarrateStyleChange,
  onPreparationChange,
}: NarrationPreparationSettingsProps) {
  const modelOptions = llmServices.flatMap((service) =>
    service.models.map((model) => ({
      value: `${service.id}::${model.id}`,
      label: `${service.name || "Service"} · ${model.name || model.id}`,
    })),
  );
  const updatePreparation = (patch: Partial<NarrationPreparationConfig>) =>
    onPreparationChange({ ...preparation, ...patch });
  const updateNumber =
    (
      key: keyof Pick<
        NarrationPreparationConfig,
        | "maxNextItems"
        | "targetChunkCount"
        | "previousContextCount"
        | "futureContextCount"
        | "minimumCoveragePercent"
      >,
    ) =>
    (value: string | number) => {
      if (typeof value === "number") updatePreparation({ [key]: value });
    };

  return (
    <section
      aria-labelledby="narration-preparation-title"
      className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-5"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <Text component="h2" id="narration-preparation-title" fw={600} c="var(--app-text)">
            Narration preparation
          </Text>
          <Text size="sm" c="var(--app-text-muted)" mt={4}>
            Prepare book text with an LLM before the selected voice turns it into speech.
          </Text>
        </div>
        <Switch
          checked={preparation.enabled}
          onChange={(event) => updatePreparation({ enabled: event.currentTarget.checked })}
          label="Enable preparation"
          labelPosition="left"
          aria-label="Enable narration preparation"
        />
      </div>

      <div className="my-5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-muted)] p-4">
        <Text size="xs" c="var(--app-text-muted)" lh={1.55}>
          The preparation provider receives the target chunks in their original form, the configured
          amount of previous processed text and future original text, plus chunk IDs and hashes. The
          request also includes narration style, quality, minimum coverage, and translation
          language. A blank language is sent explicitly as{" "}
          <Text span fw={600} c="var(--app-text)">
            none
          </Text>
          , which tells the provider to preserve the original language.
        </Text>
      </div>

      <Stack gap="md">
        <Select
          label="Preparation LLM model"
          description="The LLM service and model that rewrites narration text."
          placeholder="Select a model"
          searchable
          clearable
          disabled={!preparation.enabled}
          data={modelOptions}
          value={toModelValue(preparation.model)}
          nothingFoundMessage="Add an LLM model first"
          onChange={(value) => updatePreparation({ model: fromModelValue(value) })}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select<NarrateStyle>
            label="Narration style"
            description="Sent to the preparation provider as the requested delivery style."
            disabled={!preparation.enabled}
            allowDeselect={false}
            data={NARRATE_STYLES.map((style) => ({ value: style, label: labelFromValue(style) }))}
            value={narrateStyle}
            onChange={(value) => onNarrateStyleChange(value ?? "neutral")}
          />
          <TextInput
            label="Translation language"
            description="Leave blank to preserve the original language (sent as none)."
            placeholder="None — preserve original"
            maxLength={100}
            disabled={!preparation.enabled}
            value={preparation.targetLanguage}
            onChange={(event) => updatePreparation({ targetLanguage: event.currentTarget.value })}
          />
        </SimpleGrid>

        <div>
          <Text size="sm" fw={500} c="var(--app-text)" mb={5}>
            Preparation quality
          </Text>
          <SegmentedControl<NarrationPreparationQuality>
            fullWidth
            color="var(--app-control-active)"
            autoContrast
            withItemsBorders={false}
            disabled={!preparation.enabled}
            value={preparation.quality}
            data={NARRATION_PREPARATION_QUALITIES.map((quality) => ({
              value: quality,
              label: labelFromValue(quality),
            }))}
            onChange={(quality) => updatePreparation({ quality })}
          />
          <Text size="xs" c="var(--app-text-muted)" mt={5}>
            Controls provider reasoning effort and response budget: fast favors speed, balanced is
            the default, and high favors more careful rewriting.
          </Text>
        </div>

        <Accordion variant="contained" radius="md" order={3}>
          <Accordion.Item value="advanced-window-settings">
            <Accordion.Control>Advanced window settings</Accordion.Control>
            <Accordion.Panel>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <NumberInput
                  label="Max next items"
                  description="Maximum unprepared source items queued from the current position."
                  min={1}
                  max={100}
                  allowDecimal={false}
                  disabled={!preparation.enabled}
                  value={preparation.maxNextItems}
                  onChange={updateNumber("maxNextItems")}
                />
                <NumberInput
                  label="Target chunks per request"
                  description="Unprepared chunks sent to the LLM in each request."
                  min={1}
                  max={20}
                  allowDecimal={false}
                  disabled={!preparation.enabled}
                  value={preparation.targetChunkCount}
                  onChange={updateNumber("targetChunkCount")}
                />
                <NumberInput
                  label="Previous processed context"
                  description="Prepared chunks sent before the targets for continuity."
                  min={0}
                  max={20}
                  allowDecimal={false}
                  disabled={!preparation.enabled}
                  value={preparation.previousContextCount}
                  onChange={updateNumber("previousContextCount")}
                />
                <NumberInput
                  label="Future lookahead"
                  description="Original chunks sent after the targets for context."
                  min={0}
                  max={20}
                  allowDecimal={false}
                  disabled={!preparation.enabled}
                  value={preparation.futureContextCount}
                  onChange={updateNumber("futureContextCount")}
                />
                <NumberInput
                  label="Minimum coverage percentage"
                  description="Reject responses that account for less source material."
                  min={1}
                  max={100}
                  suffix="%"
                  allowDecimal={false}
                  disabled={!preparation.enabled}
                  value={preparation.minimumCoveragePercent}
                  onChange={updateNumber("minimumCoveragePercent")}
                />
              </SimpleGrid>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <div className="border-t border-[var(--app-border-subtle)] pt-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <Text fw={600} c="var(--app-text)">
                Narrate with AI
              </Text>
              <Text size="xs" c="var(--app-text-muted)" mt={3}>
                Generate speech with the selected voice after optional LLM preparation.
              </Text>
            </div>
            <Switch
              checked={narrateWithAI}
              onChange={(event) => onNarrateWithAIChange(event.currentTarget.checked)}
              aria-label="Narrate with AI"
            />
          </div>
          <NumberInput
            mt="md"
            label="Voice generate ahead"
            description="Upcoming prepared items converted to voice in the background. This is separate from the LLM preparation window."
            min={0}
            max={20}
            allowDecimal={false}
            disabled={!narrateWithAI}
            value={narrateAheadCount}
            onChange={(value) => {
              if (typeof value === "number") onNarrateAheadCountChange(value);
            }}
          />
        </div>
      </Stack>
    </section>
  );
}
