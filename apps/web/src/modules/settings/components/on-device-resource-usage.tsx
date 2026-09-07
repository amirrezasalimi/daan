import { ActionIcon, Text, Tooltip } from "@mantine/core";
import { Cpu, Gauge, MemoryStick, Unplug } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getBrowserTtsStateVersion,
  getLoadedBrowserTtsProviders,
  subscribeBrowserTtsState,
} from "@/shared/browser-tts";

import { useSystemResourcesQuery } from "../hooks/use-settings";
import { ResourceCurve } from "./resource-curve";

const HISTORY_SIZE = 24;

function formatBytes(bytes: number): string {
  const gigabytes = bytes / (1024 * 1024 * 1024);
  if (gigabytes >= 1) return `${gigabytes.toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Metric({ icon, label, value }: MetricProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
      <span className="flex min-w-0 items-center gap-1.5 text-[var(--app-text-muted)]">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-[var(--app-text-subtle)]">{value}</span>
    </div>
  );
}

export function OnDeviceResourceUsage() {
  useSyncExternalStore(
    subscribeBrowserTtsState,
    getBrowserTtsStateVersion,
    getBrowserTtsStateVersion,
  );
  const loadedProviders = getLoadedBrowserTtsProviders();
  const resources = useSystemResourcesQuery(loadedProviders.length > 0);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!resources.data) return;
    setCpuHistory((values) => [...values, resources.data.cpuPercent].slice(-HISTORY_SIZE));
  }, [resources.data?.sampledAt]);

  if (loadedProviders.length === 0) return null;

  const provider = loadedProviders[0];
  const model = provider?.getLoadedModel();
  const data = resources.data;

  return (
    <div className="border-t border-[var(--app-border-subtle)] pt-3">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-[var(--app-success)]" />
        <Text size="xs" fw={600} c="var(--app-text)" truncate="end" className="min-w-0 flex-1">
          {model?.name ?? provider?.name}
        </Text>
        <Tooltip label="Unload model">
          <ActionIcon
            size="xs"
            variant="subtle"
            color="red"
            aria-label={`Unload ${model?.name ?? "on-device model"}`}
            onClick={() => provider?.dispose()}
          >
            <Unplug size={12} />
          </ActionIcon>
        </Tooltip>
      </div>

      {data ? (
        <div className="mt-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-[var(--app-text-muted)]">
              <Cpu size={12} aria-hidden="true" />
              CPU{" "}
              <strong className="font-medium text-[var(--app-text)]">
                {data.cpuPercent.toFixed(0)}%
              </strong>
            </span>
            <span className="flex items-center justify-end gap-1.5 text-[var(--app-text-muted)]">
              <Gauge size={12} aria-hidden="true" />
              GPU{" "}
              <strong className="font-medium text-[var(--app-text)]">
                {data.gpu ? `${data.gpu.utilizationPercent.toFixed(0)}%` : "–"}
              </strong>
            </span>
          </div>
          <ResourceCurve label="System CPU usage history" values={cpuHistory} />
          <Metric
            icon={<MemoryStick size={12} aria-hidden="true" />}
            label="RAM"
            value={`${formatBytes(data.memoryUsedBytes)} / ${formatBytes(data.memoryTotalBytes)}`}
          />
          {data.gpu ? (
            <Metric
              icon={<MemoryStick size={12} aria-hidden="true" />}
              label="GPU memory"
              value={`${formatBytes(data.gpu.memoryUsedBytes)} / ${formatBytes(data.gpu.memoryAllocatedBytes)}`}
            />
          ) : null}
          <Metric
            icon={<Cpu size={12} aria-hidden="true" />}
            label="Daan"
            value={`${data.processCpuPercent.toFixed(1)}% · ${formatBytes(data.processMemoryBytes)}`}
          />
        </div>
      ) : (
        <Text size="xs" c="var(--app-text-subtle)" mt="xs">
          Loading telemetry…
        </Text>
      )}
    </div>
  );
}
