export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="brand-frontend min-h-svh bg-brand-page font-brand text-brand">
      {children}
    </div>
  )
}
