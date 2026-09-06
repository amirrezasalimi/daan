import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/modules/dashboard";

export const Route = createFileRoute("/")({
  component: DashboardView,
});
