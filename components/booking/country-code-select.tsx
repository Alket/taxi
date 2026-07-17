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
}

export function CountryCodeSelect({
  value,
  onChange,
  disabled,
  className,
}: CountryCodeSelectProps) {
  const options = React.useMemo(() => getPhoneCountryOptions(), [])
  const anchor = useComboboxAnchor()

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
            "flex h-12 min-w-[6.75rem] items-center justify-center gap-1.5 rounded-lg border border-border bg-brand-surface px-2.5 text-brand transition-colors",
            "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          aria-label="Country calling code"
        >
          <span className="text-lg leading-none" aria-hidden>
            {selected.flag}
          </span>
          <span className="text-sm font-bold tabular-nums">{selected.code}</span>
        </ComboboxTrigger>

        <ComboboxContent
          side="bottom"
          align="start"
          sideOffset={6}
          anchor={anchor}
          className="w-[min(20rem,calc(100vw-2rem))] min-w-[16rem] max-w-none rounded-xl bg-white p-0 text-[color:var(--brand-ink)] shadow-[0_16px_40px_rgba(15,23,42,0.16)] ring-1 ring-black/8 *:data-[slot=input-group]:m-0 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-9 *:data-[slot=input-group]:rounded-none *:data-[slot=input-group]:border-0 *:data-[slot=input-group]:border-b *:data-[slot=input-group]:border-border/70 *:data-[slot=input-group]:bg-white *:data-[slot=input-group]:px-2 *:data-[slot=input-group]:shadow-none"
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
                className="gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-[color:var(--brand-ink)] data-highlighted:bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)] data-highlighted:text-[color:var(--brand-ink)] not-data-[variant=destructive]:data-highlighted:**:text-[color:var(--brand-ink)]"
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
