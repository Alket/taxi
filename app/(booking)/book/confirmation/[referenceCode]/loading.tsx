import { BookingConfirmingScreen } from "@/components/booking/booking-confirming-screen"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { t } from "@/lib/i18n/t"

export default async function ConfirmationLoading() {
  const locale = await getRequestLocale()
  return (
    <BookingConfirmingScreen message={t(locale, "confirm.loading")} />
  )
}
