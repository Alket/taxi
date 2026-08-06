"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import type { CountryCode } from "libphonenumber-js"

import {
  getPhoneCountryOptions,
  resolvePhoneCountryOption,
  type PhoneCountryOption,
} from "@/lib/booking-details"
import { cn } from "@/lib/utils"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  useComboboxAnchor,
} from "@/components/ui/combobox"

type CountryCodeSelectProps = {
  value: string
  onChange: (countryCode: string) => void
  disabled?: boolean
  className?: string
  /** `brand` = public booking form. `admin` = dashboard sheets/dialogs. */
  variant?: "brand" | "admin"
}

export function CountryCodeSelect({
  value,
  onChange,
  disabled,
  className,
  variant = "brand",
}: CountryCodeSelectProps) {
  const options = React.useMemo(() => getPhoneCountryOptions(), [])
  const anchor = useComboboxAnchor()
  const isAdmin = variant === "admin"

  const [selectedIso, setSelectedIso] = React.useState<CountryCode>(
    () => resolvePhoneCountryOption(value).iso,
  )

  // Keep ISO in sync when the dial code is changed externally.
  React.useEffect(() => {
    const current = options.find((entry) => entry.iso === selectedIso)
    if (current?.code === value) return
    setSelectedIso(resolvePhoneCountryOption(value).iso)
  }, [value, selectedIso, options])

  const selected =
    options.find((entry) => entry.iso === selectedIso) ??
    resolvePhoneCountryOption(value)

  return (
    <div ref={anchor} className={cn("shrink-0", className)}>
      <Combobox
        items={options}
        value={selected}
        disabled={disabled}
        onValueChange={(item: PhoneCountryOption | null) => {
          if (!item) return
          setSelectedIso(item.iso)
          onChange(item.code)
        }}
        itemToStringLabel={(item: PhoneCountryOption) =>
          `${item.name} ${item.code}`
        }
        isItemEqualToValue={(a: PhoneCountryOption, b: PhoneCountryOption) =>
          a.iso === b.iso
        }
        autoHighlight
      >
        <ComboboxTrigger
          disabled={disabled}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border transition-colors",
            "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
            isAdmin
              ? "h-10 min-w-[6.5rem] border-input bg-transparent px-2.5 text-foreground hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
              : "h-12 min-w-[6.75rem] border-border bg-brand-surface px-2.5 text-brand hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-brand-accent",
          )}
          aria-label="Country calling code"
        >
          <span
            className={cn("leading-none", isAdmin ? "text-base" : "text-lg")}
            aria-hidden
          >
            {selected.flag}
          </span>
          <span
            className={cn(
              "tabular-nums",
              isAdmin ? "text-sm font-medium" : "text-sm font-bold",
            )}
          >
            {selected.code}
          </span>
        </ComboboxTrigger>

        <ComboboxContent
          side="bottom"
          align="start"
          sideOffset={6}
          anchor={anchor}
          className={cn(
            "w-[min(20rem,calc(100vw-2rem))] min-w-[16rem] max-w-none rounded-xl p-0 shadow-lg",
            isAdmin
              ? "bg-popover text-popover-foreground ring-1 ring-foreground/10 *:data-[slot=input-group]:m-0 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-9 *:data-[slot=input-group]:rounded-none *:data-[slot=input-group]:border-0 *:data-[slot=input-group]:border-b *:data-[slot=input-group]:border-border *:data-[slot=input-group]:bg-transparent *:data-[slot=input-group]:px-2 *:data-[slot=input-group]:shadow-none"
              : "bg-white text-[color:var(--brand-ink)] shadow-[0_16px_40px_rgba(15,23,42,0.16)] ring-1 ring-black/8 *:data-[slot=input-group]:m-0 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-9 *:data-[slot=input-group]:rounded-none *:data-[slot=input-group]:border-0 *:data-[slot=input-group]:border-b *:data-[slot=input-group]:border-border/70 *:data-[slot=input-group]:bg-white *:data-[slot=input-group]:px-2 *:data-[slot=input-group]:shadow-none",
          )}
        >
          <ComboboxInput
            placeholder="Search country or code"
            showTrigger={false}
            className="w-full"
          />
          <ComboboxEmpty className="flex-col items-center gap-1.5 px-4 py-6">
            <SearchIcon className="size-5 opacity-50" />
            No matching countries
          </ComboboxEmpty>
          <ComboboxList className="max-h-64 p-1.5">
            {(item: PhoneCountryOption) => (
              <ComboboxItem
                key={item.iso}
                value={item}
                className={cn(
                  "gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                  isAdmin
                    ? "font-medium"
                    : "font-semibold text-[color:var(--brand-ink)] data-highlighted:bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)] data-highlighted:text-[color:var(--brand-ink)] not-data-[variant=destructive]:data-highlighted:**:text-[color:var(--brand-ink)]",
                )}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.flag}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {item.code}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
