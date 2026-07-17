import { StarIcon, UsersIcon, ClockIcon } from "lucide-react"

export function BookingHeaderBenefits() {
  return (
    <div className="rounded-xl bg-brand-panel p-4 text-white md:p-6 lg:rounded-2xl">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 md:gap-8">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-surface/10 sm:size-12">
            <UsersIcon className="size-5 text-brand-accent sm:size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight sm:text-[13px]">
              Travellers rate us excellent
            </p>
            <p className="mt-0.5 text-[10px] text-white/60 sm:text-xs">
              4.98 / 5 average · 3000 reviews
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-surface/10 sm:size-12">
            <StarIcon className="size-5 text-brand-accent sm:size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight sm:text-[13px]">
              Best drivers in Tirana
            </p>
            <p className="mt-0.5 text-[10px] text-white/60 sm:text-xs">
              We handpick the friendliest professional drivers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-surface/10 sm:size-12">
            <ClockIcon className="size-5 text-brand-accent sm:size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight sm:text-[13px]">
              Always on time
            </p>
            <p className="mt-0.5 text-[10px] text-white/60 sm:text-xs">
              Our drivers monitor the flights in case of delays
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
