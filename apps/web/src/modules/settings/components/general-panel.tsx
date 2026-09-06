import type {
  DefaultModels,
  ExtractChapterMode,
  LlmServiceConfig,
  ModelRef,
  NarrateStyle,
  Socks5ProxyConfig,
} from "@daan/api/config/schema";
import { NARRATE_STYLES } from "@daan/api/config/schema";
import { SegmentedControl, Select, Stack, Switch, Text, TextInput } from "@mantine/core";

interface GeneralPanelProps {
  services: LlmServiceConfig[];
  proxy: Socks5ProxyConfig;
  extractChapterMode: ExtractChapterMode;
  narrateWithAI: boolean;
  narrateStyle: NarrateStyle;
  defaultModels: DefaultModels;
  onExtractChapterModeChange: (mode: ExtractChapterMode) => void;
  onNarrateWithAIChange: (value: boolean) => void;
  onNarrateStyleChange: (style: NarrateStyle) => void;
  onDefaultModelsChange: (models: DefaultModels) => void;
  onProxyChange: (proxy: Socks5ProxyConfig) => void;
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

export function GeneralPanel({
  services,
  proxy,
  extractChapterMode,
  narrateWithAI,
  narrateStyle,
  defaultModels,
  onExtractChapterModeChange,
  onNarrateWithAIChange,
  onNarrateStyleChange,
  onDefaultModelsChange,
  onProxyChange,
}: GeneralPanelProps) {
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
    <Stack gap={0}>
      <section className="border-b border-[var(--app-border-subtle)] pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Text fw={600} c="var(--app-text)" mb={4}>
              SOCKS5 proxy
            </Text>
            <Text size="xs" c="var(--app-text-muted)">
              Route supported server requests through one global proxy.
            </Text>
          </div>
          <Switch
            mt={2}
            checked={proxy.enabled}
            onChange={(event) => onProxyChange({ ...proxy, enabled: event.currentTarget.checked })}
            aria-label="Enable SOCKS5 proxy"
          />
        </div>
        {proxy.enabled ? (
          <TextInput
            mt="md"
            label="Proxy URL"
            placeholder="socks5h://127.0.0.1:10808"
            value={proxy.url}
            onChange={(event) => onProxyChange({ ...proxy, url: event.currentTarget.value })}
          />
        ) : null}
      </section>

      <section className="border-b border-[var(--app-border-subtle)] py-6">
        <Text fw={600} c="var(--app-text)" mb={4}>
          Chapter extraction
        </Text>
        <Text size="xs" c="var(--app-text-muted)" mb="md">
          Choose how chapters are detected when importing a book.
        </Text>
        <SegmentedControl
          fullWidth
          color="var(--app-control-active)"
          autoContrast
          withItemsBorders={false}
          value={extractChapterMode}
          onChange={(value) => onExtractChapterModeChange(value as ExtractChapterMode)}
          data={[
            { value: "auto", label: "Auto (fast)" },
            { value: "ai", label: "AI" },
          ]}
        />
      </section>

      <section className="border-b border-[var(--app-border-subtle)] py-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Text fw={600} c="var(--app-text)" mb={4}>
              Narrate with AI
            </Text>
            <Text size="xs" c="var(--app-text-muted)">
              Generate spoken narration using an AI voice.
            </Text>
          </div>
          <Switch
            mt={2}
            checked={narrateWithAI}
            onChange={(e) => onNarrateWithAIChange(e.currentTarget.checked)}
            aria-label="Narrate with AI"
          />
        </div>
        {narrateWithAI ? (
          <Select
            mt="md"
            label="Narration style"
            data={narrateOptions}
            value={narrateStyle}
            allowDeselect={false}
            onChange={(value) => onNarrateStyleChange((value as NarrateStyle) ?? "neutral")}
          />
        ) : null}
      </section>

      <section className="pt-6">
        <Text fw={600} c="var(--app-text)" mb={4}>
          Default models
        </Text>
        <Text size="xs" c="var(--app-text-muted)" mb="md">
          Models used for conversation and chapter extraction.
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
      </section>
    </Stack>
  );
}
