import { getSettings } from "@/lib/settings"

import { SiteFooterClient } from "@/components/marketing/site-footer-client"

function whatsappUrlFromPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "")
  return cleaned ? `https://wa.me/${cleaned}` : null
}

/** Server wrapper: loads settings; chrome labels react to client locale. */
export async function SiteFooter() {
  const settings = await getSettings()
  const companyName = settings.companyName?.trim() || "Landed"
  const supportPhone = settings.supportPhone?.trim() || ""
  const supportEmail = settings.supportEmail?.trim() || ""
  const whatsappSource = settings.supportWhatsApp?.trim() || supportPhone
  const whatsappUrl = whatsappSource
    ? whatsappUrlFromPhone(whatsappSource)
    : null
  const telHref = supportPhone.replace(/[^\d+]/g, "")

  return (
    <SiteFooterClient
      companyName={companyName}
      supportPhone={supportPhone}
      supportEmail={supportEmail}
      whatsappUrl={whatsappUrl}
      telHref={telHref}
    />
  )
}
