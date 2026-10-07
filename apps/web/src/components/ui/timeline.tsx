import { cn } from "@/lib/cn";

/** Historique d'une réservation : le plus récent en haut, carrés reliés par un filet. */
export function Timeline({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    meta: string;
    tone?: "ink" | "warning" | "success" | "danger";
  }>;
}) {
  return (
    <ol className="relative flex flex-col gap-4">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3">
          {index < items.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute top-3.5 bottom-[-16px] left-[5px] w-0.5 bg-line-soft"
            />
          )}
          <span
            aria-hidden="true"
            className={cn(
              "relative mt-[3px] size-3 shrink-0",
              item.tone === "warning"
                ? "border-2 border-warning bg-bg"
                : item.tone === "success"
                  ? "bg-success"
                  : item.tone === "danger"
                    ? "bg-danger"
                    : "bg-ink",
            )}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-bold leading-[18px] text-ink">{item.title}</p>
            <p className="font-mono text-label font-medium leading-4 text-ink-muted">{item.meta}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
