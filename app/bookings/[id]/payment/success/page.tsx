type Props = {
  params: Promise<{ id: string }>
}

export default async function PaymentSuccessPage({ params }: Props) {
  const { id } = await params

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <span className="text-sm font-medium text-success">
        Payment received
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">
        Deposit payment completed
      </h1>
      <p className="text-muted-foreground">
        Your transfer deposit has been collected successfully for booking{" "}
        <span className="font-mono">{id}</span>.
      </p>
      <p className="text-sm text-muted-foreground">
        We&apos;ll confirm the booking and contact you with trip details shortly.
      </p>
    </main>
  )
}
