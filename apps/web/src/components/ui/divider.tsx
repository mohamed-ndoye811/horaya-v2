export function OrDivider() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px grow bg-line-soft" />
      <span className="font-mono text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-neutral">
        ou
      </span>
      <span className="h-px grow bg-line-soft" />
    </div>
  );
}
