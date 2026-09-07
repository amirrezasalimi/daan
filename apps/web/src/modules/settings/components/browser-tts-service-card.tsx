import type { TtsServiceConfig } from "@daan/api/config/schema";
import { ActionIcon, Collapse, Group, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { ChevronDown, ChevronRight, Cpu, Search, Unplug, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  getBrowserTtsProvider,
  getBrowserTtsStateVersion,
  subscribeBrowserTtsState,
} from "@/shared/browser-tts";

import { BrowserVoicePreviewButton } from "./browser-voice-preview-button";

interface BrowserTtsServiceCardProps {
  service: TtsServiceConfig;
}

export function BrowserTtsServiceCard({ service }: BrowserTtsServiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const model = service.models[0];
  const provider = getBrowserTtsProvider(service.id);
  useSyncExternalStore(
    subscribeBrowserTtsState,
    getBrowserTtsStateVersion,
    getBrowserTtsStateVersion,
  );
  const isLoaded = provider?.isLoaded() ?? false;
  const allVoices = provider?.voices ?? [];
  const voices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return allVoices;
    return allVoices.filter((voice) =>
      `${voice.name} ${voice.id} ${voice.language} ${voice.gender}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [allVoices, query]);

  if (!model) return null;

  return (
    <section className="border-b border-[var(--app-border-subtle)] pb-6">
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Group gap={7}>
            <Cpu size={16} className="text-[var(--app-accent)]" />
            <Text fw={600} c="var(--app-text)">
              {service.name}
            </Text>
          </Group>
          <Text size="xs" c="var(--app-text-muted)" mt={3}>
            Runs privately on your device. The model downloads only when first used.
          </Text>
        </div>
        <Text size="xs" c="var(--app-text-subtle)">
          Built in
        </Text>
      </Group>

      <div className="rounded-lg border border-[var(--app-border-subtle)] p-4">
        <Group
          justify="space-between"
          align="flex-start"
          wrap="nowrap"
          className="cursor-pointer select-none"
          onClick={() => setExpanded((value) => !value)}
        >
          <div className="min-w-0">
            <Text size="sm" fw={500} c="var(--app-text)">
              {model.name}
            </Text>
            <Text size="xs" c="var(--app-text-muted)" mt={2}>
              Requires WebGPU · audio stays on this device · {allVoices.length} voices
            </Text>
          </div>
          <Group gap="xs" wrap="nowrap">
            {isLoaded ? (
              <Group gap={5} wrap="nowrap">
                <span
                  className="size-2 shrink-0 rounded-full bg-[var(--app-success)]"
                  aria-hidden="true"
                />
                <Text size="xs" c="var(--app-success)" fw={500}>
                  Loaded
                </Text>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  aria-label={`Unload ${model.name}`}
                  title="Unload model"
                  onClick={(event) => {
                    event.stopPropagation();
                    provider?.dispose();
                  }}
                >
                  <Unplug size={14} />
                </ActionIcon>
              </Group>
            ) : null}
            <ActionIcon
              size="sm"
              variant="subtle"
              aria-label={expanded ? "Collapse voices" : "Expand voices"}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </ActionIcon>
          </Group>
        </Group>

        <Collapse expanded={expanded}>
          <TextInput
            mt="md"
            size="xs"
            radius="xl"
            value={query}
            placeholder="Search voices, languages, or gender"
            aria-label="Search on-device voices"
            leftSection={<Search size={14} strokeWidth={1.6} />}
            rightSection={
              query ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label="Clear voice search"
                  onClick={() => setQuery("")}
                >
                  <X size={13} />
                </ActionIcon>
              ) : null
            }
            rightSectionPointerEvents={query ? "all" : "none"}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />

          <ScrollArea.Autosize mah={360} type="auto" offsetScrollbars="y" mt="sm">
            <Stack gap={0} pr="xs">
              {voices.map((voice) => (
                <Group
                  key={voice.id}
                  justify="space-between"
                  wrap="nowrap"
                  className="border-b border-[var(--app-border-subtle)] py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <Text size="sm" c="var(--app-text)" truncate>
                      {voice.name}
                    </Text>
                    <Text size="xs" c="var(--app-text-subtle)" truncate>
                      {voice.language} · {voice.gender} · {voice.id}
                    </Text>
                  </div>
                  <BrowserVoicePreviewButton
                    serviceId={service.id}
                    model={model.id}
                    voice={voice.id}
                  />
                </Group>
              ))}
              {voices.length === 0 ? (
                <Text size="sm" c="var(--app-text-subtle)" ta="center" py="lg">
                  No matching voices.
                </Text>
              ) : null}
            </Stack>
          </ScrollArea.Autosize>
        </Collapse>
      </div>
    </section>
  );
}
