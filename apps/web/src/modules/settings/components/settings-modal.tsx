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
      centered
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      styles={{
        content: {
          height: MODAL_HEIGHT,
          display: "flex",
          flexDirection: "column",
        },
        body: {
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
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
            list: { borderInlineEnd: "none", gap: "0.25rem" },
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
          <Tabs.List w={200} className="shrink-0" pr="sm">
            <Tabs.Tab
              value="services"
              className="data-[active]:bg-[var(--app-surface-muted)] data-[active]:font-medium data-[active]:!border-l-[var(--app-accent)]"
              leftSection={<Server size={16} strokeWidth={1.5} />}
            >
              LLM services
            </Tabs.Tab>
            <Tabs.Tab
              value="defaults"
              className="data-[active]:bg-[var(--app-surface-muted)] data-[active]:font-medium data-[active]:!border-l-[var(--app-accent)]"
              leftSection={<SlidersHorizontal size={16} strokeWidth={1.5} />}
            >
              Defaults
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="services" className="min-h-0 flex-1">
            <ScrollArea h="100%" px="lg" type="auto">
              <LlmServicesPanel
                services={draft.llmServices}
                onChange={(llmServices) => setDraft({ ...draft, llmServices })}
              />
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="defaults" className="min-h-0 flex-1">
            <ScrollArea h="100%" px="lg" type="auto">
              <DefaultsPanel
                services={draft.llmServices}
                extractChapterMode={draft.extractChapterMode}
                narrateWithAI={draft.narrateWithAI}
                narrateStyle={draft.narrateStyle}
                defaultModels={draft.defaultModels}
                onExtractChapterModeChange={(extractChapterMode) =>
                  setDraft({ ...draft, extractChapterMode })
                }
                onNarrateWithAIChange={(narrateWithAI) =>
                  setDraft({ ...draft, narrateWithAI })
                }
                onNarrateStyleChange={(narrateStyle) =>
                  setDraft({ ...draft, narrateStyle })
                }
                onDefaultModelsChange={(defaultModels) =>
                  setDraft({ ...draft, defaultModels })
                }
              />
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      ) : null}

      <Group
        justify="flex-end"
        pt="md"
        className="shrink-0 border-t border-[var(--app-border-subtle)]"
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
