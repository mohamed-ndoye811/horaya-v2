import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceOnboarding } from "@/features/auth/workspace-onboarding";
import { getOnboardingStep } from "@/functions/auth";

export const Route = createFileRoute("/(auth)/inscription/espace")({
  loader: () => getOnboardingStep({ data: "espace" }),
  head: () => ({ meta: [{ title: "Ton espace · Horaya" }] }),
  component: WorkspaceOnboarding,
});
