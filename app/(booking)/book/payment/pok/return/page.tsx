import { Suspense } from "react"
import { Loader2Icon } from "lucide-react"

import PokReturnClient from "./pok-return-client"

export default function PokReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 p-6">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PokReturnClient />
    </Suspense>
  )
}
