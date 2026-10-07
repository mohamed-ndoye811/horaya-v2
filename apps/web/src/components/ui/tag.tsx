import { cn } from "@/lib/cn";

const tones = {
  ink: "bg-ink text-on-ink border-ink",
  outline: "border-ink text-ink",
  success: "border-success text-success",
  draft: "border-draft text-draft bg-draft-bg",
};

/** Étiquette compacte en capitales mono (VIP, ENTREPRISE…). */
export function Tag({
  children,
  tone = "outline",
}: {
  children: string;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center border-[1.5px] px-1.5 font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.06em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
