export interface NavigationLink {
  readonly to: string;
  readonly label: string;
}

export const NAV_LINKS: readonly NavigationLink[] = [{ to: "/", label: "Dashboard" }] as const;

export const EXTERNAL_LINKS = {
  mantineDocs: "https://mantine.dev",
  mantineLlms: "https://mantine.dev/llms.txt",
  mantineLlmsFull: "https://mantine.dev/llms-full.txt",
  bunqueueDocs: "https://bunqueue.dev",
  bunqueueLlms: "http://bunqueue.dev/llms.txt",
} as const;
