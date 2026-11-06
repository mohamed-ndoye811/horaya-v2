import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
};

/** Message en tête de formulaire (erreur globale, confirmation…) : encadré teinté arrondi (DA v4). */
export function FormAlert({
  tone = "danger",
  icon,
  children,
}: {
  tone?: keyof typeof tones;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex animate-drop items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold leading-[18px]",
        tones[tone],
      )}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
