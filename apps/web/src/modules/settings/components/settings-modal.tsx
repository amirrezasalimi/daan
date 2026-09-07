import type { AppConfig } from "@daan/api/config/schema";
import { Button, Group, Modal, ScrollArea, Tabs } from "@mantine/core";
import { AudioLines, Server, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { useSettingsQuery, useUpdateSettings } from "../hooks/use-settings";
import { GeneralPanel } from "./general-panel";
import { LlmServicesPanel } from "./llm-services-panel";
import { NarrationServicesPanel } from "./narration-services-panel";
import { OnDeviceResourceUsage } from "./on-device-resource-usage";

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
              width: "100%",
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
          <div className="flex w-52 shrink-0 flex-col py-5">
            <Tabs.List className="w-full">
              <Tabs.Tab
                value="services"
                className="px-4 py-3 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] data-[active]:bg-[var(--app-surface-muted)] data-[active]:font-medium data-[active]:text-[var(--app-text)] data-[active]:!border-l-[var(--app-accent)]"
                leftSection={<Server size={16} strokeWidth={1.5} />}
              >
                LLM services
              </Tabs.Tab>
              <Tabs.Tab
                value="narration"
                className="px-4 py-3 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] data-[active]:bg-[var(--app-surface-muted)] data-[active]:font-medium data-[active]:text-[var(--app-text)] data-[active]:!border-l-[var(--app-accent)]"
                leftSection={<AudioLines size={16} strokeWidth={1.5} />}
              >
                Narration
              </Tabs.Tab>
              <Tabs.Tab
                value="general"
                className="px-4 py-3 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] data-[active]:bg-[var(--app-surface-muted)] data-[active]:font-medium data-[active]:text-[var(--app-text)] data-[active]:!border-l-[var(--app-accent)]"
                leftSection={<SlidersHorizontal size={16} strokeWidth={1.5} />}
              >
                General
              </Tabs.Tab>
            </Tabs.List>
            <div className="mt-auto px-4">
              <OnDeviceResourceUsage />
            </div>
          </div>

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

          <Tabs.Panel value="narration" className="min-h-0 flex-1">
            <ScrollArea h="100%" type="auto">
              <div className="p-6">
                <NarrationServicesPanel
                  services={draft.ttsServices}
                  proxy={draft.socks5Proxy}
                  defaultModel={draft.defaultTtsModel}
                  onServicesChange={(ttsServices) => setDraft({ ...draft, ttsServices })}
                  onDefaultModelChange={(defaultTtsModel) =>
                    setDraft({ ...draft, defaultTtsModel })
                  }
                />
              </div>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="general" className="min-h-0 flex-1">
            <ScrollArea h="100%" type="auto">
              <div className="p-6">
                <GeneralPanel
                  services={draft.llmServices}
                  proxy={draft.socks5Proxy}
                  extractChapterMode={draft.extractChapterMode}
                  narrateWithAI={draft.narrateWithAI}
                  narrateAheadCount={draft.narrateAheadCount}
                  narrateStyle={draft.narrateStyle}
                  defaultModels={draft.defaultModels}
                  onExtractChapterModeChange={(extractChapterMode) =>
                    setDraft({ ...draft, extractChapterMode })
                  }
                  onNarrateWithAIChange={(narrateWithAI) => setDraft({ ...draft, narrateWithAI })}
                  onNarrateAheadCountChange={(narrateAheadCount) =>
                    setDraft({ ...draft, narrateAheadCount })
                  }
                  onNarrateStyleChange={(narrateStyle) => setDraft({ ...draft, narrateStyle })}
                  onDefaultModelsChange={(defaultModels) => setDraft({ ...draft, defaultModels })}
                  onProxyChange={(socks5Proxy) => setDraft({ ...draft, socks5Proxy })}
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
