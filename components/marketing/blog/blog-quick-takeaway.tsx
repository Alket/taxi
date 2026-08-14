export function BlogQuickTakeaway({ text }: { text: string }) {
  return (
    <aside
      aria-label="Quick takeaway"
      className="rounded-2xl border border-brand-accent/25 bg-[color-mix(in_srgb,var(--brand-accent)_10%,white)] px-5 py-5 sm:px-6 sm:py-6"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
        Quick Takeaway
      </p>
      <p className="mt-2 text-base leading-relaxed font-medium text-brand md:text-lg">
        {text}
      </p>
    </aside>
  )
}
