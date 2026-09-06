import type {
  DefaultModels,
  ExtractChapterMode,
  LlmServiceConfig,
  ModelRef,
  NarrateStyle,
} from "@daan/api/config/schema";
import { NARRATE_STYLES } from "@daan/api/config/schema";
import { SegmentedControl, Select, Stack, Switch, Text } from "@mantine/core";

interface DefaultsPanelProps {
  services: LlmServiceConfig[];
  extractChapterMode: ExtractChapterMode;
  narrateWithAI: boolean;
  narrateStyle: NarrateStyle;
  defaultModels: DefaultModels;
  onExtractChapterModeChange: (mode: ExtractChapterMode) => void;
  onNarrateWithAIChange: (value: boolean) => void;
  onNarrateStyleChange: (style: NarrateStyle) => void;
  onDefaultModelsChange: (models: DefaultModels) => void;
}

function toValue(ref: ModelRef): string | null {
  if (!ref.service || !ref.model) return null;
  return `${ref.service}::${ref.model}`;
}

function fromValue(value: string | null): ModelRef {
  if (!value) return { service: "", model: "" };
  const [service, model] = value.split("::");
  return { service: service ?? "", model: model ?? "" };
}

export function DefaultsPanel({
  services,
  extractChapterMode,
  narrateWithAI,
  narrateStyle,
  defaultModels,
  onExtractChapterModeChange,
  onNarrateWithAIChange,
  onNarrateStyleChange,
  onDefaultModelsChange,
}: DefaultsPanelProps) {
  const modelOptions = services.flatMap((service) =>
    service.models.map((model) => ({
      value: `${service.id}::${model.id}`,
      label: `${service.name || "Service"} · ${model.name || model.id}`,
    })),
  );

  const narrateOptions = NARRATE_STYLES.map((style) => ({
    value: style,
    label: style.charAt(0).toUpperCase() + style.slice(1),
  }));

  return (
    <Stack gap="lg">
      <div>
        <Text fw={600} c="var(--app-text)" mb={4}>
          Chapter extraction
        </Text>
        <Text size="xs" c="var(--app-text-muted)" mb="xs">
          How chapters are detected when importing a book.
        </Text>
        <SegmentedControl
          value={extractChapterMode}
          onChange={(value) =>
            onExtractChapterModeChange(value as ExtractChapterMode)
          }
          data={[
            { value: "auto", label: "Auto (fast)" },
            { value: "ai", label: "AI" },
          ]}
        />
      </div>

      <div>
        <Switch
          checked={narrateWithAI}
          onChange={(e) => onNarrateWithAIChange(e.currentTarget.checked)}
          label="Narrate with AI"
          description="Generate spoken narration using an AI voice."
        />
        {narrateWithAI ? (
          <Select
            mt="sm"
            label="Narration style"
            data={narrateOptions}
            value={narrateStyle}
            allowDeselect={false}
            onChange={(value) =>
              onNarrateStyleChange((value as NarrateStyle) ?? "neutral")
            }
          />
        ) : null}
      </div>

      <div>
        <Text fw={600} c="var(--app-text)" mb="xs">
          Default models
        </Text>
        <Stack gap="sm">
          <Select
            label="Chat"
            placeholder="Select a model"
            data={modelOptions}
            value={toValue(defaultModels.chat)}
            nothingFoundMessage="Add a model first"
            onChange={(value) =>
              onDefaultModelsChange({
                ...defaultModels,
                chat: fromValue(value),
              })
            }
          />
          <Select
            label="Extract chapters"
            placeholder="Select a model"
            data={modelOptions}
            value={toValue(defaultModels.extractChapters)}
            nothingFoundMessage="Add a model first"
            onChange={(value) =>
              onDefaultModelsChange({
                ...defaultModels,
                extractChapters: fromValue(value),
              })
            }
          />
        </Stack>
      </div>
    </Stack>
  );
}
