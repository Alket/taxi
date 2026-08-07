/**
 * Seed PageContent locale rows for built-in destinations so marketing
 * destination cards/pages are not stuck on English when the visitor switches
 * language. Idempotent: updates existing locale rows' text fields.
 *
 * Run: npx tsx scripts/seed-destination-i18n.ts
 */
import { prisma } from "@/lib/db"
import { DESTINATIONS } from "@/lib/destinations"
import { LOCALES, type Locale } from "@/lib/i18n/locales"
import { parseSections, sectionHeading, sectionValue } from "@/lib/page-content-shared"

type DestCopy = {
  name: string
  region: string
  description: string
  badge: string
  distance: string
  duration: string
  whyBook: string
}

function copyFromEnglishSections(
  sections: ReturnType<typeof parseSections>,
  fallback: (typeof DESTINATIONS)[number],
): DestCopy {
  return {
    name: sectionHeading(sections, "title") || fallback.name,
    region: sectionValue(sections, "region") || fallback.region,
    description:
      sectionValue(sections, "description") || fallback.description,
    badge: sectionValue(sections, "badge") || fallback.badge,
    distance: sectionValue(sections, "route.distance"),
    duration: sectionValue(sections, "route.duration"),
    whyBook: sectionValue(sections, "route.whyBook"),
  }
}

/** Curated translations for built-in destinations (name/region/description/badge/route). */
const COPY: Record<Exclude<Locale, "en">, Record<string, DestCopy>> = {
  it: {
    tirana: {
      name: "Tirana City Escape",
      region: "Albania centrale",
      description:
        "Capital vibrante, caffè e collegamenti rapidi con l'aeroporto per soggiorni in città.",
      badge: "Popolare",
      distance: "Circa 17 km dall'aeroporto di Tirana (TIA).",
      duration: "25–40 minuti a seconda del traffico.",
      whyBook:
        "Prezzo fisso, conducente che ti aspetta in arrivi e assistenza bagagli inclusa.",
    },
    durres: {
      name: "Durrës Coast",
      region: "Costa adriatica",
      description:
        "Città portuale storica con spiagge sabbiose e rovine romane a pochi minuti dalla costa.",
      badge: "Di tendenza",
      distance: "Circa 40 km dall'aeroporto di Tirana (TIA).",
      duration: "40–55 minuti.",
      whyBook:
        "Trasferimento diretto alla costa senza cambi di mezzo o attese ai taxi.",
    },
    vlore: {
      name: "Vlorë Riviera",
      region: "Riviera albanese",
      description:
        "Porta del sud — baie turchesi, lungomare e tramonti sul mare.",
      badge: "Costa",
      distance: "Circa 150 km dall'aeroporto di Tirana (TIA).",
      duration: "2–2,5 ore.",
      whyBook:
        "Viaggio comodo verso la riviera con prezzo bloccato in anticipo.",
    },
    sarande: {
      name: "Sarandë Seaside",
      region: "Costa meridionale",
      description:
        "Vivace città di mare di fronte a Corfù, acque cristalline e vita notturna.",
      badge: "Miglior rapporto",
      distance: "Circa 280 km dall'aeroporto di Tirana (TIA).",
      duration: "4–5 ore.",
      whyBook:
        "Trasferimento porta a porta verso Sarandë senza scali intermedi.",
    },
    ksamil: {
      name: "Ksamil Islands",
      region: "Parco Nazionale di Butrinto",
      description:
        "Isole turchesi iconiche e calette di sabbia bianca sullo Ionio.",
      badge: "Da vedere",
      distance: "Circa 290 km dall'aeroporto di Tirana (TIA).",
      duration: "4,5–5,5 ore.",
      whyBook:
        "Arriva riposato alle isole — conducente privato e prezzo fisso.",
    },
    berat: {
      name: "Berat Heritage",
      region: "Patrimonio UNESCO",
      description:
        "La città dalle mille finestre — architettura ottomana e castelli sulla collina.",
      badge: "Cultura",
      distance: "Circa 120 km dall'aeroporto di Tirana (TIA).",
      duration: "2–2,5 ore.",
      whyBook:
        "Trasferimento comodo al patrimonio UNESCO di Berat.",
    },
    shkoder: {
      name: "Shkodër Lakeside",
      region: "Albania settentrionale",
      description:
        "Charme lacustre, percorsi ciclabili e porta verso le Accursed Mountains.",
      badge: "Avventura",
      distance: "Circa 100 km dall'aeroporto di Tirana (TIA).",
      duration: "1,5–2 ore.",
      whyBook:
        "Partenza diretta verso il nord senza cambi di autobus.",
    },
    theth: {
      name: "Theth Wilderness",
      region: "Alpi albanesi",
      description:
        "Valli montane remote, torri di pietra tradizionali e sentieri alpini.",
      badge: "Montagne",
      distance: "Circa 170 km dall'aeroporto di Tirana (TIA).",
      duration: "4–6 ore a seconda della stagione e della strada.",
      whyBook:
        "Conducente abituato alle strade di montagna e orari flessibili.",
    },
  },
  de: {
    tirana: {
      name: "Tirana City Escape",
      region: "Zentralalbanien",
      description:
        "Lebendige Hauptstadt, Cafés und schnelle Flughafenanbindung für Städtereisen.",
      badge: "Beliebt",
      distance: "Etwa 17 km vom Flughafen Tirana (TIA).",
      duration: "25–40 Minuten je nach Verkehr.",
      whyBook:
        "Festpreis, Fahrer wartet in der Ankunftshalle, Gepäckhilfe inklusive.",
    },
    durres: {
      name: "Durrës Coast",
      region: "Adriaküste",
      description:
        "Historische Hafenstadt mit Sandstränden und römischen Ruinen nah am Meer.",
      badge: "Im Trend",
      distance: "Etwa 40 km vom Flughafen Tirana (TIA).",
      duration: "40–55 Minuten.",
      whyBook:
        "Direkter Transfer zur Küste ohne Umsteigen oder Taxi-Wartezeiten.",
    },
    vlore: {
      name: "Vlorë Riviera",
      region: "Albanische Riviera",
      description:
        "Tor zum Süden — türkisfarbene Buchten, Promenaden und Sonnenuntergänge.",
      badge: "Küste",
      distance: "Etwa 150 km vom Flughafen Tirana (TIA).",
      duration: "2–2,5 Stunden.",
      whyBook:
        "Bequeme Fahrt an die Riviera mit im Voraus festem Preis.",
    },
    sarande: {
      name: "Sarandë Seaside",
      region: "Südküste",
      description:
        "Lebhafte Seestadt gegenüber Korfu, klares Wasser und Nachtleben.",
      badge: "Preis-Leistung",
      distance: "Etwa 280 km vom Flughafen Tirana (TIA).",
      duration: "4–5 Stunden.",
      whyBook:
        "Tür-zu-Tür-Transfer nach Sarandë ohne Zwischenstopps.",
    },
    ksamil: {
      name: "Ksamil Islands",
      region: "Nationalpark Butrint",
      description:
        "Ikonische türkisfarbene Inseln und weiße Sandbuchten am Ionischen Meer.",
      badge: "Muss man sehen",
      distance: "Etwa 290 km vom Flughafen Tirana (TIA).",
      duration: "4,5–5,5 Stunden.",
      whyBook:
        "Ausgeruht an den Inseln ankommen — Privatfahrer und Festpreis.",
    },
    berat: {
      name: "Berat Heritage",
      region: "UNESCO-Erbe",
      description:
        "Die Stadt der tausend Fenster — osmanische Architektur und Bergkastelle.",
      badge: "Kultur",
      distance: "Etwa 120 km vom Flughafen Tirana (TIA).",
      duration: "2–2,5 Stunden.",
      whyBook:
        "Bequemer Transfer zum UNESCO-Erbe von Berat.",
    },
    shkoder: {
      name: "Shkodër Lakeside",
      region: "Nordalbanien",
      description:
        "See-Charme, Radwege und Tor zu den Accursed Mountains.",
      badge: "Abenteuer",
      distance: "Etwa 100 km vom Flughafen Tirana (TIA).",
      duration: "1,5–2 Stunden.",
      whyBook:
        "Direkt nach Norden ohne Busumsteigen.",
    },
    theth: {
      name: "Theth Wilderness",
      region: "Albanische Alpen",
      description:
        "Abgelegene Bergtäler, traditionelle Steintürme und alpine Wanderwege.",
      badge: "Berge",
      distance: "Etwa 170 km vom Flughafen Tirana (TIA).",
      duration: "4–6 Stunden je nach Saison und Straße.",
      whyBook:
        "Fahrer mit Erfahrung auf Bergstraßen und flexiblen Zeiten.",
    },
  },
  pl: {
    tirana: {
      name: "Tirana City Escape",
      region: "Albania centralna",
      description:
        "Tętniąca życiem stolica, kawiarnie i szybkie połączenie z lotniskiem.",
      badge: "Popularne",
      distance: "Około 17 km od lotniska w Tiranie (TIA).",
      duration: "25–40 minut w zależności od ruchu.",
      whyBook:
        "Stała cena, kierowca czeka na przylotach, pomoc z bagażem w cenie.",
    },
    durres: {
      name: "Durrës Coast",
      region: "Wybrzeże Adriatyku",
      description:
        "Historyczne miasto portowe z piaszczystymi plażami i ruinami rzymskimi.",
      badge: "Na topie",
      distance: "Około 40 km od lotniska w Tiranie (TIA).",
      duration: "40–55 minut.",
      whyBook:
        "Bezpośredni transfer na wybrzeże bez przesiadek.",
    },
    vlore: {
      name: "Vlorë Riviera",
      region: "Riwiera albańska",
      description:
        "Brama na południe — turkusowe zatoki, promenady i zachody słońca.",
      badge: "Wybrzeże",
      distance: "Około 150 km od lotniska w Tiranie (TIA).",
      duration: "2–2,5 godziny.",
      whyBook:
        "Wygodna podróż na riwierę ze stałą ceną z góry.",
    },
    sarande: {
      name: "Sarandë Seaside",
      region: "Południowe wybrzeże",
      description:
        "Żywe nadmorskie miasto naprzeciw Korfu, krystaliczna woda i życie nocne.",
      badge: "Najlepsza wartość",
      distance: "Około 280 km od lotniska w Tiranie (TIA).",
      duration: "4–5 godzin.",
      whyBook:
        "Transfer door-to-door do Sarandy bez postojów.",
    },
    ksamil: {
      name: "Ksamil Islands",
      region: "Park Narodowy Butrint",
      description:
        "Ikoniczne turkusowe wyspy i białe zatoczki nad Morzem Jońskim.",
      badge: "Obowiązkowe",
      distance: "Około 290 km od lotniska w Tiranie (TIA).",
      duration: "4,5–5,5 godziny.",
      whyBook:
        "Dotrzyj wypoczęty na wyspy — prywatny kierowca i stała cena.",
    },
    berat: {
      name: "Berat Heritage",
      region: "Dziedzictwo UNESCO",
      description:
        "Miasto tysiąca okien — osmańska architektura i zamki na wzgórzu.",
      badge: "Kultura",
      distance: "Około 120 km od lotniska w Tiranie (TIA).",
      duration: "2–2,5 godziny.",
      whyBook:
        "Wygodny transfer do dziedzictwa UNESCO w Beracie.",
    },
    shkoder: {
      name: "Shkodër Lakeside",
      region: "Północna Albania",
      description:
        "Urok jeziora, trasy rowerowe i brama do Accursed Mountains.",
      badge: "Przygoda",
      distance: "Około 100 km od lotniska w Tiranie (TIA).",
      duration: "1,5–2 godziny.",
      whyBook:
        "Bezpośredni wyjazd na północ bez przesiadek autobusowych.",
    },
    theth: {
      name: "Theth Wilderness",
      region: "Alpy Albańskie",
      description:
        "Odległe doliny górskie, tradycyjne kamienne wieże i szlaki alpejskie.",
      badge: "Góry",
      distance: "Około 170 km od lotniska w Tiranie (TIA).",
      duration: "4–6 godzin w zależności od sezonu i drogi.",
      whyBook:
        "Kierowca znający górskie drogi i elastyczne godziny.",
    },
  },
  tr: {
    tirana: {
      name: "Tirana City Escape",
      region: "Orta Arnavutluk",
      description:
        "Canlı başkent, kafeler ve şehir konaklamaları için hızlı havaalanı bağlantısı.",
      badge: "Popüler",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 17 km.",
      duration: "Trafiğe göre 25–40 dakika.",
      whyBook:
        "Sabit fiyat, varışta sizi bekleyen şoför ve bagaj yardımı dahil.",
    },
    durres: {
      name: "Durrës Coast",
      region: "Adriyatik Sahili",
      description:
        "Kumsal plajları ve Roma kalıntılarıyla tarihi liman kenti.",
      badge: "Trend",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 40 km.",
      duration: "40–55 dakika.",
      whyBook:
        "Aktarma ve taksi beklemesi olmadan doğrudan sahile transfer.",
    },
    vlore: {
      name: "Vlorë Riviera",
      region: "Arnavut Rivierası",
      description:
        "Güneyin kapısı — turkuaz koylar, gezinti yolları ve gün batımı manzaraları.",
      badge: "Sahil",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 150 km.",
      duration: "2–2,5 saat.",
      whyBook:
        "Önceden sabitlenmiş fiyatla riviera'ya konforlu yolculuk.",
    },
    sarande: {
      name: "Sarandë Seaside",
      region: "Güney Sahil",
      description:
        "Korfu'nun karşısında canlı sahil kasabası, berrak sular ve gece hayatı.",
      badge: "En iyi değer",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 280 km.",
      duration: "4–5 saat.",
      whyBook:
        "Ara durak olmadan kapıdan kapıya Sarandë transferi.",
    },
    ksamil: {
      name: "Ksamil Islands",
      region: "Butrint Milli Parkı",
      description:
        "İyon Denizi'nde ikonik turkuaz adalar ve beyaz kum koyları.",
      badge: "Görülmeli",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 290 km.",
      duration: "4,5–5,5 saat.",
      whyBook:
        "Adalara dinlenmiş varın — özel şoför ve sabit fiyat.",
    },
    berat: {
      name: "Berat Heritage",
      region: "UNESCO Mirası",
      description:
        "Bin pencerenin şehri — Osmanlı mimarisi ve tepe kaleleri.",
      badge: "Kültür",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 120 km.",
      duration: "2–2,5 saat.",
      whyBook:
        "Berat UNESCO mirasına konforlu transfer.",
    },
    shkoder: {
      name: "Shkodër Lakeside",
      region: "Kuzey Arnavutluk",
      description:
        "Göl kenarı cazibesi, bisiklet rotaları ve Accursed Mountains'a giriş.",
      badge: "Macera",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 100 km.",
      duration: "1,5–2 saat.",
      whyBook:
        "Otobüs aktarması olmadan doğrudan kuzeye.",
    },
    theth: {
      name: "Theth Wilderness",
      region: "Arnavut Alpleri",
      description:
        "Uzak dağ vadileri, geleneksel taş kuleler ve alpin yürüyüş parkuru.",
      badge: "Dağlar",
      distance: "Tiran Havalimanı'na (TIA) yaklaşık 170 km.",
      duration: "Mevsime ve yola göre 4–6 saat.",
      whyBook:
        "Dağ yollarına alışkın şoför ve esnek saatler.",
    },
  },
  uk: {
    tirana: {
      name: "Tirana City Escape",
      region: "Центральна Албанія",
      description:
        "Жвава столиця, кав'ярні та швидкий зв'язок з аеропортом для міських поїздок.",
      badge: "Популярне",
      distance: "Близько 17 км від аеропорту Тирани (TIA).",
      duration: "25–40 хвилин залежно від трафіку.",
      whyBook:
        "Фіксована ціна, водій чекає на прильоті, допомога з багажем включена.",
    },
    durres: {
      name: "Durrës Coast",
      region: "Адріатичне узбережжя",
      description:
        "Історичне портове місто з піщаними пляжами та римськими руїнами біля моря.",
      badge: "У тренді",
      distance: "Близько 40 км від аеропорту Тирани (TIA).",
      duration: "40–55 хвилин.",
      whyBook:
        "Прямий трансфер на узбережжя без пересадок.",
    },
    vlore: {
      name: "Vlorë Riviera",
      region: "Албанська Рив'єра",
      description:
        "Брама на південь — бірюзові бухти, набережні та заходи сонця.",
      badge: "Узбережжя",
      distance: "Близько 150 км від аеропорту Тирани (TIA).",
      duration: "2–2,5 години.",
      whyBook:
        "Комфортна поїздка на рив'єру з фіксованою ціною наперед.",
    },
    sarande: {
      name: "Sarandë Seaside",
      region: "Південне узбережжя",
      description:
        "Жваве приморське місто навпроти Корфу, кришталева вода та нічне життя.",
      badge: "Найкраща ціна",
      distance: "Близько 280 км від аеропорту Тирани (TIA).",
      duration: "4–5 годин.",
      whyBook:
        "Трансфер від дверей до дверей у Саранду без зупинок.",
    },
    ksamil: {
      name: "Ksamil Islands",
      region: "Національний парк Бутрінт",
      description:
        "Іконічні бірюзові острови та білі піщані бухти Іонічного моря.",
      badge: "Обов'язково",
      distance: "Близько 290 км від аеропорту Тирани (TIA).",
      duration: "4,5–5,5 години.",
      whyBook:
        "Прибудьте відпочилими на острови — приватний водій і фіксована ціна.",
    },
    berat: {
      name: "Berat Heritage",
      region: "Спадщина ЮНЕСКО",
      description:
        "Місто тисячі вікон — османська архітектура та замки на пагорбі.",
      badge: "Культура",
      distance: "Близько 120 км від аеропорту Тирани (TIA).",
      duration: "2–2,5 години.",
      whyBook:
        "Зручний трансфер до спадщини ЮНЕСКО в Бераті.",
    },
    shkoder: {
      name: "Shkodër Lakeside",
      region: "Північна Албанія",
      description:
        "Озерний шарм, велосипедні маршрути та брама до Accursed Mountains.",
      badge: "Пригоди",
      distance: "Близько 100 км від аеропорту Тирани (TIA).",
      duration: "1,5–2 години.",
      whyBook:
        "Прямий виїзд на північ без автобусних пересадок.",
    },
    theth: {
      name: "Theth Wilderness",
      region: "Албанські Альпи",
      description:
        "Віддалені гірські долини, традиційні кам'яні вежі та альпійські стежки.",
      badge: "Гори",
      distance: "Близько 170 км від аеропорту Тирани (TIA).",
      duration: "4–6 годин залежно від сезону та дороги.",
      whyBook:
        "Водій, звичний до гірських доріг, і гнучкий час.",
    },
  },
  ru: {
    tirana: {
      name: "Tirana City Escape",
      region: "Центральная Албания",
      description:
        "Оживлённая столица, кафе и быстрая связь с аэропортом для городских поездок.",
      badge: "Популярное",
      distance: "Около 17 км от аэропорта Тираны (TIA).",
      duration: "25–40 минут в зависимости от трафика.",
      whyBook:
        "Фиксированная цена, водитель ждёт в зале прилёта, помощь с багажом включена.",
    },
    durres: {
      name: "Durrës Coast",
      region: "Адриатическое побережье",
      description:
        "Исторический портовый город с песчаными пляжами и римскими руинами у моря.",
      badge: "В тренде",
      distance: "Около 40 км от аэропорта Тираны (TIA).",
      duration: "40–55 минут.",
      whyBook:
        "Прямой трансфер на побережье без пересадок.",
    },
    vlore: {
      name: "Vlorë Riviera",
      region: "Албанская Ривьера",
      description:
        "Ворота на юг — бирюзовые бухты, набережные и закаты.",
      badge: "Побережье",
      distance: "Около 150 км от аэропорта Тираны (TIA).",
      duration: "2–2,5 часа.",
      whyBook:
        "Комфортная поездка на ривьеру с заранее фиксированной ценой.",
    },
    sarande: {
      name: "Sarandë Seaside",
      region: "Южное побережье",
      description:
        "Живой приморский город напротив Корфу, кристальная вода и ночная жизнь.",
      badge: "Лучшая цена",
      distance: "Около 280 км от аэропорта Тираны (TIA).",
      duration: "4–5 часов.",
      whyBook:
        "Трансфер от двери до двери в Саранду без остановок.",
    },
    ksamil: {
      name: "Ksamil Islands",
      region: "Национальный парк Бутринт",
      description:
        "Иконические бирюзовые острова и белые песчаные бухты Ионического моря.",
      badge: "Обязательно",
      distance: "Около 290 км от аэропорта Тираны (TIA).",
      duration: "4,5–5,5 часа.",
      whyBook:
        "Приезжайте отдохнувшими на острова — частный водитель и фиксированная цена.",
    },
    berat: {
      name: "Berat Heritage",
      region: "Наследие ЮНЕСКО",
      description:
        "Город тысячи окон — османская архитектура и замки на холме.",
      badge: "Культура",
      distance: "Около 120 км от аэропорта Тираны (TIA).",
      duration: "2–2,5 часа.",
      whyBook:
        "Удобный трансфер к наследию ЮНЕСКО в Берате.",
    },
    shkoder: {
      name: "Shkodër Lakeside",
      region: "Северная Албания",
      description:
        "Озёрный шарм, велосипедные маршруты и ворота к Accursed Mountains.",
      badge: "Приключения",
      distance: "Около 100 км от аэропорта Тираны (TIA).",
      duration: "1,5–2 часа.",
      whyBook:
        "Прямой выезд на север без автобусных пересадок.",
    },
    theth: {
      name: "Theth Wilderness",
      region: "Албанские Альпы",
      description:
        "Удалённые горные долины, традиционные каменные башни и альпийские тропы.",
      badge: "Горы",
      distance: "Около 170 км от аэропорта Тираны (TIA).",
      duration: "4–6 часов в зависимости от сезона и дороги.",
      whyBook:
        "Водитель, привычный к горным дорогам, и гибкое время.",
    },
  },
}

function applyCopy(
  sections: ReturnType<typeof parseSections>,
  copy: DestCopy,
) {
  const setHeading = (key: string, heading: string) => {
    const s = sections.find((x) => x.key === key)
    if (s) s.heading = heading
  }
  const setBody = (key: string, body: string) => {
    const s = sections.find((x) => x.key === key)
    if (s) s.body = body
  }

  setHeading("title", copy.name)
  setBody("region", copy.region)
  setBody("description", copy.description)
  setBody("badge", copy.badge)
  setHeading("route.heading", `Getting to ${copy.name}`)
  // Localized route heading per locale is set below by caller when needed
  setBody("route.distance", copy.distance)
  setBody("route.duration", copy.duration)
  setBody("route.whyBook", copy.whyBook)
}

const ROUTE_HEADING: Record<Locale, (name: string) => string> = {
  en: (n) => `Getting to ${n}`,
  it: (n) => `Come arrivare a ${n}`,
  de: (n) => `Anreise nach ${n}`,
  pl: (n) => `Jak dojechać do ${n}`,
  tr: (n) => `${n} yolculuğu`,
  uk: (n) => `Як дістатися до ${n}`,
  ru: (n) => `Как добраться до ${n}`,
}

const TITLE_TMPL: Record<Locale, (name: string) => string> = {
  en: (n) => `${n} airport transfer`,
  it: (n) => `Transfer aeroporto ${n}`,
  de: (n) => `${n} Flughafentransfer`,
  pl: (n) => `Transfer lotniskowy ${n}`,
  tr: (n) => `${n} havalimanı transferi`,
  uk: (n) => `Трансфер з аеропорту до ${n}`,
  ru: (n) => `Трансфер из аэропорта в ${n}`,
}

async function main() {
  let upserted = 0
  let skipped = 0

  for (const dest of DESTINATIONS) {
    const slug = `destinations/${dest.id}`
    const enRow = await prisma.pageContent.findUnique({
      where: { slug_locale: { slug, locale: "en" } },
    })
    if (!enRow) {
      console.log(`skip ${slug}: no English row`)
      skipped += 1
      continue
    }

    const baseSections = parseSections(enRow.sections)
    const englishCopy = copyFromEnglishSections(baseSections, dest)

    for (const locale of LOCALES) {
      if (locale === "en") continue
      const copy = COPY[locale][dest.id] ?? englishCopy

      const sections = structuredClone(baseSections)
      applyCopy(sections, copy)
      const routeHeading = sections.find((s) => s.key === "route.heading")
      if (routeHeading) {
        routeHeading.heading = ROUTE_HEADING[locale](copy.name)
      }

      const title = TITLE_TMPL[locale](copy.name)
      const description = copy.description

      await prisma.pageContent.upsert({
        where: { slug_locale: { slug, locale } },
        create: {
          slug,
          locale,
          label: enRow.label,
          title,
          description,
          ogImage: enRow.ogImage,
          sections,
        },
        update: {
          title,
          description,
          sections,
        },
      })
      upserted += 1
      console.log(`upserted ${slug}/${locale}`)
    }
  }

  console.log(`Done. upserted=${upserted} skipped=${skipped}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
