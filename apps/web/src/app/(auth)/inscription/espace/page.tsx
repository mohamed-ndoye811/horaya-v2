import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listMyWorkspaces, requireSession } from "@/server/auth";
import { WorkspaceOnboarding } from "./workspace-onboarding";

export const metadata: Metadata = { title: "Ton espace · Horaya" };

export default async function WorkspacePage() {
  await requireSession();
  if ((await listMyWorkspaces()).length > 0) redirect("/app");

  return <WorkspaceOnboarding />;
}
