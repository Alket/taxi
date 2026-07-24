"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2Icon, StarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type LookupPayload = {
  booking: {
    id: string
    referenceCode: string
    pickupAddress: string
    dropoffAddress: string
    pickupDateTime: string
    customerName: string
    customerEmail: string
    driverName: string
  }
  alreadySubmitted: boolean
  reviewStatus: "pending" | "approved" | "rejected" | null
}

function StarPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            className={cn(
              "rounded-md p-1 transition-colors touch-manipulation",
              disabled ? "cursor-default" : "hover:bg-muted",
            )}
            onClick={() => onChange(star)}
          >
            <StarIcon
              className={cn(
                "size-7",
                star <= value
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
        <span className="ml-2 text-sm tabular-nums text-muted-foreground">
          {value}/5
        </span>
      </div>
    </div>
  )
}

export function ReviewFormView() {
  const searchParams = useSearchParams()
  const [reference, setReference] = React.useState(
    searchParams.get("reference")?.toUpperCase() ?? "",
  )
  const [email, setEmail] = React.useState(searchParams.get("email") ?? "")
  const [pending, setPending] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [payload, setPayload] = React.useState<LookupPayload | null>(null)
  const [done, setDone] = React.useState(false)

  const [driverRating, setDriverRating] = React.useState(5)
  const [platformRating, setPlatformRating] = React.useState(5)
  const [driverComment, setDriverComment] = React.useState("")
  const [platformComment, setPlatformComment] = React.useState("")

  React.useEffect(() => {
    const ref = searchParams.get("reference")
    const mail = searchParams.get("email")
    if (ref && mail) void lookup(ref, mail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function lookup(ref = reference, mail = email) {
    const cleanedRef = ref.trim()
    const cleanedEmail = mail.trim()
    if (!cleanedRef || !cleanedEmail) {
      setError("Enter your reference code and email.")
      return
    }
    setPending(true)
    setError(null)
    setPayload(null)
    setDone(false)
    try {
      const params = new URLSearchParams({
        reference: cleanedRef,
        email: cleanedEmail,
      })
      const res = await fetch(`/api/reviews/lookup?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ||
            "We couldn't find a booking matching those details.",
        )
        return
      }
      setReference(cleanedRef.toUpperCase())
      setEmail(cleanedEmail)
      setPayload(data as LookupPayload)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  async function submit() {
    if (!payload || payload.alreadySubmitted) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          email,
          driverRating,
          platformRating,
          driverComment: driverComment.trim() || null,
          platformComment: platformComment.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          (data as { error?: string }).error || "Could not submit review.",
        )
        return
      }
      setDone(true)
      toast.success("Thanks — your review was submitted.")
    } catch {
      toast.error("Could not submit review.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 md:px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Leave a review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rate your driver and overall experience. One review per booking.
        </p>
      </div>

      {!payload ? (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-ref">Booking reference</Label>
            <Input
              id="review-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              placeholder="TRF-XXXXXX"
              autoCapitalize="characters"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-email">Email</Label>
            <Input
              id="review-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <Button
            type="button"
            disabled={pending}
            onClick={() => void lookup()}
          >
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
                Looking up…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      ) : done || payload.alreadySubmitted ? (
        <div className="rounded-xl border bg-card p-5 text-center">
          <p className="font-medium">
            {done
              ? "Thank you for your feedback"
              : "Review already submitted"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {done
              ? "Your review is pending moderation and is not public yet."
              : payload.reviewStatus === "approved"
                ? "Your review for this trip is already on file."
                : "You already left feedback for this booking."}
          </p>
          <p className="mt-3 font-mono text-sm">{payload.booking.referenceCode}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
          <div>
            <p className="font-mono text-sm font-semibold">
              {payload.booking.referenceCode}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {payload.booking.pickupAddress} → {payload.booking.dropoffAddress}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Driver: {payload.booking.driverName}
            </p>
          </div>

          <StarPicker
            label="Driver rating"
            value={driverRating}
            onChange={setDriverRating}
            disabled={submitting}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="driver-comment">Comment about the driver (optional)</Label>
            <Textarea
              id="driver-comment"
              value={driverComment}
              onChange={(e) => setDriverComment(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={submitting}
            />
          </div>

          <StarPicker
            label="Platform / overall experience"
            value={platformRating}
            onChange={setPlatformRating}
            disabled={submitting}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="platform-comment">
              Comment about the overall experience (optional)
            </Label>
            <Textarea
              id="platform-comment"
              value={platformComment}
              onChange={(e) => setPlatformComment(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={submitting}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              disabled={submitting}
              onClick={() => {
                setPayload(null)
                setDone(false)
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              className="sm:flex-1"
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                  Submitting…
                </>
              ) : (
                "Submit review"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
