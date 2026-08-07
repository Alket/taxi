/** Renders a `<script type="application/ld+json">` block. Server component — no client JS needed. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // Escape "<" so CMS-sourced text (name/description/etc.) can never break out
  // of the script tag (e.g. a value containing "</script><script>...").
  const json = JSON.stringify(data).replace(/</g, "\\u003c")
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- JSON.stringify of our own typed builder output, escaped above.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
