import { Suspense } from "react"
import { Loader2Icon } from "lucide-react"

import PaypalReturnClient from "./paypal-return-client"

export default function PaypalReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 p-6">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PaypalReturnClient />
    </Suspense>
  )
}
