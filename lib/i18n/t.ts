import en from "@/messages/en.json"
import it from "@/messages/it.json"
import de from "@/messages/de.json"
import pl from "@/messages/pl.json"
import tr from "@/messages/tr.json"
import uk from "@/messages/uk.json"
import ru from "@/messages/ru.json"

import {
  DEFAULT_LOCALE,
  type Locale,
} from "@/lib/i18n/locales"

type MessageDict = Record<string, string>

const CATALOGS: Record<Locale, MessageDict> = {
  en,
  it,
  de,
  pl,
  tr,
  uk,
  ru,
}

export type MessageKey = keyof typeof en

/** Translate a chrome UI string. Falls back to English, then the key. */
export function t(
  locale: Locale,
  key: MessageKey | string,
  vars?: Record<string, string | number>,
): string {
  const dict = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE]
  let value =
    dict[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? String(key)

  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement))
    }
  }
  return value
}

export function getMessages(locale: Locale): MessageDict {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE]
}
