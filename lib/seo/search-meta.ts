import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  type Locale,
} from "@/lib/i18n/locales"

const BRAND = "Landed Albania"

/**
 * One brand, once, at the end. Next's layout template would otherwise append
 * " · Landed Albania" again on every nested page.
 */
export function searchTitle(pageTitle: string): { absolute: string } {
  const stripped = pageTitle
    .replace(/\s*[|·]\s*(Landed Albania|Landed)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return { absolute: `${stripped} | ${BRAND}` }
}

/**
 * When a locale URL still serves English SEO copy (no translation yet),
 * disambiguate title/description so search tools do not flag duplicates.
 * Prefer filling unique SEO fields per language in admin.
 */
export function localizeFallbackSearchCopy(
  locale: Locale,
  title: string,
  description: string,
  englishTitle: string,
  englishDescription: string,
): { title: string; description: string } {
  if (locale === DEFAULT_LOCALE) {
    return { title, description }
  }
  const lang = LOCALE_LABELS[locale].label
  const sameTitle =
    title.trim().toLowerCase() === englishTitle.trim().toLowerCase()
  const sameDescription =
    description.trim().toLowerCase() ===
    englishDescription.trim().toLowerCase()

  let nextTitle = title.trim()
  if (sameTitle) {
    nextTitle = nextTitle
      .replace(/\s*[|·]\s*(Landed Albania|Landed)\s*$/i, "")
      .trim()
    nextTitle = `${nextTitle} (${lang})`
  }

  let nextDescription = description.trim()
  if (sameDescription && nextDescription) {
    const marker = ` (${lang})`
    const max = 155
    if (nextDescription.length + marker.length <= max) {
      nextDescription = `${nextDescription}${marker}`
    } else {
      nextDescription = `${nextDescription.slice(0, Math.max(0, max - marker.length - 1)).trimEnd()}…${marker}`
    }
  }

  return { title: nextTitle, description: nextDescription }
}

type Copy = { heading: string; description: string }

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "")
}

const CITY: Record<string, Record<Locale, string>> = {
  sarande: {
    en: "Sarandë",
    de: "Saranda",
    it: "Saranda",
    pl: "Sarandy",
    tr: "Saranda",
    ru: "Саранду",
    uk: "Саранди",
  },
  ksamil: {
    en: "Ksamil",
    de: "Ksamil",
    it: "Ksamil",
    pl: "Ksamilu",
    tr: "Ksamil",
    ru: "Ксамил",
    uk: "Ксаміля",
  },
  vlore: {
    en: "Vlorë",
    de: "Vlora",
    it: "Valona",
    pl: "Wlory",
    tr: "Avlonya",
    ru: "Влёру",
    uk: "Вльори",
  },
  berat: {
    en: "Berat",
    de: "Berat",
    it: "Berat",
    pl: "Beratu",
    tr: "Berat",
    ru: "Берат",
    uk: "Берата",
  },
  shkoder: {
    en: "Shkodër",
    de: "Shkodër",
    it: "Scutari",
    pl: "Shkodry",
    tr: "İşkodra",
    ru: "Шкодер",
    uk: "Шкодера",
  },
  theth: {
    en: "Theth",
    de: "Theth",
    it: "Theth",
    pl: "Theth",
    tr: "Theth",
    ru: "Тет",
    uk: "Тета",
  },
  durres: {
    en: "Durrës",
    de: "Durrës",
    it: "Durazzo",
    pl: "Durrës",
    tr: "Dıraç",
    ru: "Дуррес",
    uk: "Дурреса",
  },
  tirana: {
    en: "Tirana",
    de: "Tirana",
    it: "Tirana",
    pl: "Tirany",
    tr: "Tiran",
    ru: "Тирану",
    uk: "Тирани",
  },
  dhermi: {
    en: "Dhërmi",
    de: "Dhërmi",
    it: "Dhërmi",
    pl: "Dhërmi",
    tr: "Dhërmi",
    ru: "Дерми",
    uk: "Дермі",
  },
}

const DESTINATION_HEADING: Record<Locale, string> = {
  en: "Tirana Airport to {city} Transfer",
  de: "Transfer vom Flughafen Tirana nach {city}",
  it: "Transfer dall'Aeroporto di Tirana a {city}",
  pl: "Transfer z lotniska w Tiranie do {city}",
  tr: "Tiran Havalimanı {city} transferi",
  ru: "Трансфер из аэропорта Тираны в {city}",
  uk: "Трансфер з аеропорту Тирани до {city}",
}

const DESTINATION_DESCRIPTION: Record<Locale, string> = {
  en: "Book a private transfer from Tirana Airport to {city}. Fixed fare, flight tracking, and meet-and-greet. Pay the driver in cash.",
  de: "Buchen Sie einen privaten Transfer vom Flughafen Tirana nach {city}. Festpreis, Flugverfolgung und Barzahlung beim Fahrer.",
  it: "Prenota un transfer privato dall'Aeroporto di Tirana a {city}. Tariffa fissa, monitoraggio volo e pagamento in contanti all'autista.",
  pl: "Zarezerwuj prywatny transfer z lotniska w Tiranie do {city}. Stała cena, śledzenie lotu i płatność gotówką u kierowcy.",
  tr: "Tiran Havalimanı'ndan {city} için özel transfer ayırtın. Sabit fiyat, uçuş takibi ve şoföre nakit ödeme.",
  ru: "Закажите частный трансфер из аэропорта Тираны в {city}. Фиксированная цена, встреча в аэропорту и оплата водителю наличными.",
  uk: "Замовте приватний трансфер з аеропорту Тирани до {city}. Фіксована ціна, зустріч в аеропорту та оплата водієві готівкою.",
}

const TRANSFER_HEADING: Record<Locale, string> = {
  en: "Private taxi from Tirana Airport to {city}",
  de: "Privattaxi vom Flughafen Tirana nach {city}",
  it: "Taxi privato dall'Aeroporto di Tirana a {city}",
  pl: "Prywatna taksówka z lotniska w Tiranie do {city}",
  tr: "Tiran Havalimanı'ndan {city} özel taksi",
  ru: "Частное такси из аэропорта Тираны в {city}",
  uk: "Приватне таксі з аеропорту Тирани до {city}",
}

const TRANSFER_DESCRIPTION: Record<Locale, string> = {
  en: "Reserve a private driver from Tirana Airport to {city}{price}. Flight tracking and meet-and-greet. Pay the driver in cash.",
  de: "Reservieren Sie einen Privatfahrer vom Flughafen Tirana nach {city}{price}. Flugverfolgung und Meet-and-greet. Barzahlung beim Fahrer.",
  it: "Prenota un autista privato dall'Aeroporto di Tirana a {city}{price}. Monitoraggio volo e accoglienza. Paga in contanti all'autista.",
  pl: "Zarezerwuj prywatnego kierowcę z lotniska w Tiranie do {city}{price}. Śledzenie lotu i powitanie. Zapłać kierowcy gotówką.",
  tr: "Tiran Havalimanı'ndan {city} için özel şoför ayırtın{price}. Uçuş takibi ve karşılama. Ücreti nakit ödeyin.",
  ru: "Закажите частного водителя из аэропорта Тираны в {city}{price}. Отслеживание рейса и встреча. Оплата водителю наличными.",
  uk: "Замовте приватного водія з аеропорту Тирани до {city}{price}. Відстеження рейсу і зустріч. Оплата водієві готівкою.",
}

const TRANSFER_PRICE: Record<Locale, string> = {
  en: " for €{price}",
  de: " für €{price}",
  it: " a €{price}",
  pl: " za €{price}",
  tr: " (€{price})",
  ru: " за €{price}",
  uk: " за €{price}",
}

const HOME: Record<Locale, Copy> = {
  en: {
    heading: "Tirana Airport Transfers & Taxi",
    description:
      "Book a private Tirana Airport transfer to Sarandë, Ksamil, Berat and more. Fixed fare, flight tracking, and meet-and-greet.",
  },
  de: {
    heading: "Flughafentransfer Tirana & Taxi",
    description:
      "Buchen Sie einen privaten Transfer vom Flughafen Tirana nach Saranda, Ksamil, Berat und weiter. Festpreis, Flugverfolgung und Empfang.",
  },
  it: {
    heading: "Transfer e taxi aeroporto di Tirana",
    description:
      "Prenota un transfer privato dall'Aeroporto di Tirana a Saranda, Ksamil, Berat e altre città. Tariffa fissa e monitoraggio volo.",
  },
  pl: {
    heading: "Transfer i taxi z lotniska w Tiranie",
    description:
      "Zarezerwuj prywatny transfer z lotniska w Tiranie do Sarandy, Ksamilu, Beratu i dalej. Stała cena, śledzenie lotu i powitanie.",
  },
  tr: {
    heading: "Tiran Havalimanı transferi ve taksi",
    description:
      "Tiran Havalimanı'ndan Saranda, Ksamil, Berat ve diğer şehirlere özel transfer ayırtın. Sabit fiyat, uçuş takibi ve karşılama.",
  },
  ru: {
    heading: "Трансфер и такси из аэропорта Тираны",
    description:
      "Закажите частный трансфер из аэропорта Тираны в Саранду, Ксамил, Берат и другие города. Фиксированная цена и встреча в аэропорту.",
  },
  uk: {
    heading: "Трансфер і таксі з аеропорту Тирани",
    description:
      "Замовте приватний трансфер з аеропорту Тирани до Саранди, Ксаміля, Берата та інших міст. Фіксована ціна і зустріч в аеропорту.",
  },
}

export function homeSearchCopy(locale: Locale): Copy {
  return HOME[locale] ?? HOME.en
}

export function destinationSearchCopy(
  id: string,
  locale: Locale,
): Copy | null {
  const city = CITY[id]?.[locale]
  if (!city) return null
  return {
    heading: fill(DESTINATION_HEADING[locale], { city }),
    description: fill(DESTINATION_DESCRIPTION[locale], { city }),
  }
}

export function transferSearchCopy(
  id: string,
  locale: Locale,
  fallbackName: string,
  priceEur: number,
): Copy {
  const city = CITY[id]?.[locale] || fallbackName
  const price =
    priceEur > 0 ? fill(TRANSFER_PRICE[locale], { price: String(priceEur) }) : ""
  return {
    heading: fill(TRANSFER_HEADING[locale], { city }),
    description: fill(TRANSFER_DESCRIPTION[locale], { city, price }),
  }
}

/** Route slug `tirana-airport-to-saranda` → destination id `sarande`. */
export function transferRouteId(slug: string): string {
  const tail = slug.replace(/^tirana-airport-to-/, "")
  if (tail === "saranda") return "sarande"
  if (tail === "vlora") return "vlore"
  return tail
}
