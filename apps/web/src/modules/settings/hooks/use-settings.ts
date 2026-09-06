import type { AppConfig } from "@daan/api/config/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client, orpc } from "@/shared/utils/orpc";

export function useSettingsQuery() {
  return useQuery(orpc.settings.get.queryOptions());
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AppConfig) => client.settings.update(config),
    onSuccess: (data) => {
      queryClient.setQueryData(orpc.settings.get.queryKey(), data);
      toast.success("Settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings");
    },
  });
}

export function useListDeepgramVoices() {
  return useMutation({
    mutationFn: (proxy: AppConfig["socks5Proxy"]) => client.settings.listDeepgramVoices(proxy),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to load Deepgram voices");
    },
  });
}

export function useListModels() {
  return useMutation({
    mutationFn: (input: { endpoint: string; apiKey: string }) => client.settings.listModels(input),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to load models");
    },
  });
}
