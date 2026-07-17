type Props = {
  params: Promise<{ id: string }>
}

export default async function PaymentCancelPage({ params }: Props) {
  const { id } = await params

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <span className="text-sm font-medium text-warning">
        Payment not completed
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">
        Deposit payment was cancelled
      </h1>
      <p className="text-muted-foreground">
        No charge was captured for booking <span className="font-mono">{id}</span>.
      </p>
      <p className="text-sm text-muted-foreground">
        You can return to the link sent by the admin and try again whenever
        you&apos;re ready.
      </p>
    </main>
  )
}
