import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  danger: "border-danger bg-danger-bg text-danger",
  success: "border-success bg-success-bg text-success",
  info: "border-info bg-info-bg text-info",
};

/** Message en tête de formulaire (erreur globale, confirmation…). */
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
        "flex items-center gap-3 border-[1.5px] px-3.5 py-3 text-sm font-semibold leading-[18px]",
        tones[tone],
      )}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
