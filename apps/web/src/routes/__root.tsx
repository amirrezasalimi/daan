import { MantineProvider } from "@mantine/core";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import { Toaster } from "@/shared/components/sonner";
import { appTheme } from "@/shared/styles/theme";
import type { orpc } from "@/shared/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "daan",
      },
      {
        name: "description",
        content: "daan is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <MantineProvider defaultColorScheme="light" theme={appTheme}>
        <Outlet />
        <Toaster richColors />
      </MantineProvider>
    </>
  );
}
