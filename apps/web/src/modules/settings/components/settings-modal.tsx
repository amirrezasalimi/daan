import type { AppConfig } from "@daan/api/config/schema";
import { Button, Group, Modal, ScrollArea, Tabs } from "@mantine/core";
import { Server, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { useSettingsQuery, useUpdateSettings } from "../hooks/use-settings";
import { DefaultsPanel } from "./defaults-panel";
import { LlmServicesPanel } from "./llm-services-panel";

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

const MODAL_HEIGHT = "90vh";

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const { data, isLoading } = useSettingsQuery();
  const updateSettings = useUpdateSettings();
  const [draft, setDraft] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (opened && data) {
      setDraft(structuredClone(data));
    }
  }, [opened, data]);

  const handleSave = () => {
    if (!draft) return;
    updateSettings.mutate(draft, { onSuccess: () => onClose() });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Settings"
      size="60rem"
      radius="lg"
      padding={0}
      centered
      styles={{
        content: {
          height: MODAL_HEIGHT,
          display: "flex",
          flexDirection: "column",
        },
        header: {
          minHeight: "4.5rem",
          padding: "1.25rem 1.5rem",
        },
        title: {
          color: "var(--app-text)",
          fontSize: "1.125rem",
          fontWeight: 600,
        },
        body: {
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: 0,
        },
      }}
    >
      {draft && !isLoading ? (
        <Tabs
          defaultValue="services"
          color="brand"
          orientation="vertical"
          className="flex min-h-0 flex-1"
          styles={{
            list: { gap: "0.25rem" },
            tab: {
              justifyContent: "flex-start",
              textAlign: "left",
              borderRadius: 0,
              borderStartEndRadius: "var(--mantine-radius-md)",
              borderEndEndRadius: "var(--mantine-radius-md)",
              borderInlineEnd: "none",
              borderInlineStart: "2px solid transparent",
            },
            tabLabel: { textAlign: "left", flex: 1 },
          }}
        >
          <Tabs.List
            w={208}
            className="shrink-0 border-r border-[var(--app-border-subtle)] px-4 py-5"
          >
            <Tabs.Tab
              value="services"
              className="px-4 py-3 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] data-[active]:bg-[var(--app-surface-muted)] data-[active]:font-medium data-[active]:text-[var(--app-text)] data-[active]:!border-l-[var(--app-accent)]"
              leftSection={<Server size={16} strokeWidth={1.5} />}
            >
              LLM services
            </Tabs.Tab>
            <Tabs.Tab
              value="defaults"
              className="px-4 py-3 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] data-[active]:bg-[var(--app-surface-muted)] data-[active]:font-medium data-[active]:text-[var(--app-text)] data-[active]:!border-l-[var(--app-accent)]"
              leftSection={<SlidersHorizontal size={16} strokeWidth={1.5} />}
            >
              Defaults
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="services" className="min-h-0 flex-1">
            <ScrollArea h="100%" type="auto">
              <div className="p-6">
                <LlmServicesPanel
                  services={draft.llmServices}
                  onChange={(llmServices) => setDraft({ ...draft, llmServices })}
                />
              </div>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="defaults" className="min-h-0 flex-1">
            <ScrollArea h="100%" type="auto">
              <div className="p-6">
                <DefaultsPanel
                  services={draft.llmServices}
                  extractChapterMode={draft.extractChapterMode}
                  narrateWithAI={draft.narrateWithAI}
                  narrateStyle={draft.narrateStyle}
                  defaultModels={draft.defaultModels}
                  onExtractChapterModeChange={(extractChapterMode) =>
                    setDraft({ ...draft, extractChapterMode })
                  }
                  onNarrateWithAIChange={(narrateWithAI) => setDraft({ ...draft, narrateWithAI })}
                  onNarrateStyleChange={(narrateStyle) => setDraft({ ...draft, narrateStyle })}
                  onDefaultModelsChange={(defaultModels) => setDraft({ ...draft, defaultModels })}
                />
              </div>
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      ) : null}

      <Group
        justify="flex-end"
        gap="sm"
        className="shrink-0 border-t border-[var(--app-border-subtle)] px-6 py-4"
      >
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="brand"
          loading={updateSettings.isPending}
          disabled={!draft}
          onClick={handleSave}
        >
          Save changes
        </Button>
      </Group>
    </Modal>
  );
}
