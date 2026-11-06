import { cn } from "@/lib/cn";

const dots = {
  ink: "bg-ink",
  warning: "bg-warning shadow-[0_0_0_4px_var(--color-warning-bg)]",
  success: "bg-success",
  danger: "bg-danger",
  muted: "border-2 border-[#cfcfcb] bg-surface",
};

/** Historique (DA v4) : le plus récent en haut, pastilles rondes reliées par un filet. */
export function Timeline({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    meta: string;
    tone?: keyof typeof dots;
  }>;
}) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={item.id} className="flex gap-3">
            <span aria-hidden="true" className="flex w-3 shrink-0 flex-col items-center">
              <span
                className={cn("mt-1 size-2.5 shrink-0 rounded-full", dots[item.tone ?? "ink"])}
              />
              {!last && <span className="mt-1.5 w-0.5 flex-1 bg-[#eaeae7]" />}
            </span>
            <div className={cn("flex min-w-0 flex-col gap-0.5", !last && "pb-[26px]")}>
              <p className="text-sm font-semibold leading-[18px] text-ink">{item.title}</p>
              <p className="text-xs leading-4 text-ink-subtle">{item.meta}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
