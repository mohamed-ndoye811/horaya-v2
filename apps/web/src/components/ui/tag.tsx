import { cn } from "@/lib/cn";

const tones = {
  ink: "bg-ink text-white font-bold",
  outline: "border border-[#d6d6d2] text-[#4a4a4a] font-semibold",
  success: "bg-success-bg text-success font-bold",
  draft: "bg-draft-bg text-draft font-bold",
  /** Sur fond noir (aperçu de la fiche client). */
  inverse: "border border-white/20 text-white/85 font-semibold",
};

/** Étiquette en pilule (VIP, Entreprise, Nouveau…). `lg` : en-tête de fiche client. */
export function Tag({
  children,
  tone = "outline",
  size = "md",
}: {
  children: string;
  tone?: keyof typeof tones;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full",
        size === "lg"
          ? "h-[26px] px-[11px] text-[13px] leading-4"
          : "h-[22px] px-2.5 text-xs leading-4",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
