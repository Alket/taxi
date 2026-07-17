"use client"

import Link from "next/link"
import { Suspense } from "react"

import { HeroBookingCard } from "@/components/marketing/hero-booking-card"
import { Skeleton } from "@/components/ui/skeleton"

const DESTINATIONS = [
  "Tirana",
  "Durrës",
  "Vlorë",
  "Sarandë",
  "Ksamil",
  "Berat",
  "Shkodër",
  "Theth",
]

export function HomeLanding() {
  return (
    <div className="brand-frontend min-h-svh bg-brand-page font-brand text-brand antialiased">
      <style>{`
        @keyframes home-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes home-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .home-fade-up {
          animation: home-fade-up 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .home-fade-up-delay {
          animation: home-fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
        }
        .home-card-enter {
          animation: home-fade-up 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
        }
        .home-hero-bg {
          animation: home-fade-in 1.2s ease both;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-fade-up,
          .home-fade-up-delay,
          .home-card-enter,
          .home-hero-bg {
            animation: none;
          }
        }
      `}</style>

      {/* Full-viewport hero */}
      <section className="relative isolate min-h-svh">
        <div className="home-hero-bg absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg"
            alt=""
            className="h-full w-full object-cover object-[72%_center] md:object-[80%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,18,22,0.78)_0%,rgba(8,18,22,0.55)_42%,rgba(8,18,22,0.28)_100%)]" />
        </div>

        <header className="relative z-20">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6 lg:px-8">
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Albania Transfers
            </span>
            <nav className="flex items-center gap-3">
              <a
                href="#how"
                className="hidden text-sm text-white/80 transition-colors hover:text-white sm:inline"
              >
                How it works
              </a>
              <Link
                href="/my-booking"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-accent px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-hover"
              >
                My Bookings
              </Link>
            </nav>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-16 md:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] md:items-center md:gap-12 md:px-6 md:pt-14 md:pb-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,26rem)] lg:px-8 lg:pt-16">
          <div className="home-fade-up max-w-xl text-white">
            <h1 className="text-[clamp(2.6rem,7vw,4.25rem)] font-bold leading-[1.05] tracking-tight text-balance">
              Arrive. Discover.
              <br />
              Experience.
            </h1>
            <p className="home-fade-up-delay mt-4 max-w-md text-base leading-relaxed text-white/85 md:text-lg">
              Personalised airport transfers designed for travel across Albania.
            </p>
          </div>

          <div id="book" className="home-card-enter w-full max-w-md justify-self-end md:max-w-none">
            <Suspense
              fallback={
                <div className="rounded-2xl bg-brand-surface p-6 shadow-xl">
                  <Skeleton className="h-80 w-full" />
                </div>
              }
            >
              <HeroBookingCard />
            </Suspense>
          </div>
        </div>
      </section>

      <section
        id="how"
        className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24 lg:px-8"
      >
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          How it works
        </p>
        <h2 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight text-brand md:text-4xl">
          Three steps from runway to road
        </h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          <li className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-brand-accent">
              01
            </p>
            <h3 className="mt-2 text-lg font-semibold text-brand">
              Choose your route
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pick airport direction, a covered destination, and your pickup
              time.
            </p>
          </li>
          <li className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-brand-accent">
              02
            </p>
            <h3 className="mt-2 text-lg font-semibold text-brand">
              Select a vehicle
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              See live prices for sedan, comfort, minivan, or premium.
            </p>
          </li>
          <li className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-brand-accent">
              03
            </p>
            <h3 className="mt-2 text-lg font-semibold text-brand">
              Confirm and go
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pay a deposit online or cash on arrival when available.
            </p>
          </li>
        </ol>
      </section>

      <section className="border-y border-border bg-brand-page">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Coverage
          </p>
          <h2 className="mt-3 max-w-lg text-3xl font-bold leading-tight tracking-tight text-brand md:text-4xl">
            Destinations we serve every day
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            From the capital and the Adriatic coast to mountain gateways.
          </p>
          <p className="mt-8 text-xl leading-relaxed text-brand md:text-2xl">
            {DESTINATIONS.map((name, i) => (
              <span key={name}>
                <span className="whitespace-nowrap">{name}</span>
                {i < DESTINATIONS.length - 1 ? (
                  <span className="mx-2 text-brand-accent"> · </span>
                ) : null}
              </span>
            ))}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Why ride with us
        </p>
        <h2 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight text-brand md:text-4xl">
          Built for arrivals, not surprises
        </h2>
        <ul className="mt-10 max-w-2xl space-y-6 text-base leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-brand">Fixed prices</span>
            {" — "}
            quoted before you book, with a clear deposit and balance split.
          </li>
          <li>
            <span className="font-semibold text-brand">Flight-aware pickups</span>
            {" — "}
            share your flight number and we adjust when landings shift.
          </li>
          <li>
            <span className="font-semibold text-brand">
              Free cancellation window
            </span>
            {" — "}
            cancel free within the policy window on your booking.
          </li>
        </ul>
        <div className="mt-10">
          <a
            href="#book"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-hover"
          >
            Back to booking
          </a>
        </div>
      </section>

      <footer className="border-t border-border bg-brand-panel text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-end md:justify-between md:px-6 lg:px-8">
          <div>
            <p className="text-2xl font-semibold tracking-tight">
              Albania Transfers
            </p>
            <p className="mt-1 text-sm text-white/65">
              Airport transfers across Albania.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/my-booking" className="text-white/80 hover:text-white">
              Look up a booking
            </Link>
            <a href="#book" className="text-white/80 hover:text-white">
              Book a transfer
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
