/**
 * Temporary QA: verifies POK credential storage (encrypted at rest), config
 * resolution per mode, and that the checkout route respects the enable toggle.
 * Restores the previous settings before exiting.
 *
 * Run with: npx tsx scripts/qa-pok-config.ts
 */
import { prisma } from "@/lib/db"
import { getPokConfig } from "@/lib/pok"
import { encryptSecret } from "@/lib/secret-box"
import { SETTINGS_ID } from "@/lib/settings"

const BASE = "http://127.0.0.1:3000"

async function main() {
  const before = await prisma.settings.findUniqueOrThrow({
    where: { id: SETTINGS_ID },
    select: {
      pokEnabled: true,
      pokMode: true,
      pokStagingKeyId: true,
      pokStagingKeySecret: true,
      pokStagingMerchantId: true,
      pokLiveKeyId: true,
      pokLiveKeySecret: true,
      pokLiveMerchantId: true,
    },
  })

  try {
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: {
        pokEnabled: false,
        pokMode: "test",
        pokStagingKeyId: "qa-key-id",
        pokStagingKeySecret: encryptSecret("qa-key-secret"),
        pokStagingMerchantId: "qa-merchant",
        pokLiveKeyId: "qa-live-key-id",
        pokLiveKeySecret: encryptSecret("qa-live-secret"),
        pokLiveMerchantId: "qa-live-merchant",
      },
    })

    const stored = await prisma.settings.findUniqueOrThrow({
      where: { id: SETTINGS_ID },
      select: { pokStagingKeySecret: true },
    })
    check(
      "secret encrypted at rest",
      stored.pokStagingKeySecret.startsWith("enc:v1:") &&
        !stored.pokStagingKeySecret.includes("qa-key-secret"),
    )

    const staging = await getPokConfig()
    check("staging configured", staging.configured)
    check("staging secret decrypted", staging.keySecret === "qa-key-secret")
    check("staging merchant", staging.merchantId === "qa-merchant")
    check("staging base url", staging.baseUrl === "https://api-staging.pokpay.io")
    check("staging env flag", staging.environment === "staging")

    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: { pokMode: "live" },
    })
    const live = await getPokConfig()
    check("live secret decrypted", live.keySecret === "qa-live-secret")
    check("live base url", live.baseUrl === "https://api.pokpay.io")
    check("live env flag", live.environment === "production")

    // Configured but toggled off → route must refuse before touching POK.
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: { pokMode: "test", pokEnabled: false },
    })
    const disabled = await post("/api/payments/pok/create-order", {
      bookingId: "whatever",
    })
    check(
      `disabled toggle blocks checkout (got ${disabled.status} ${disabled.body.code})`,
      disabled.status === 403 && disabled.body.code === "METHOD_DISABLED",
    )

    // Enabled + configured but unknown booking → 404, i.e. we got past the guards.
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: { pokEnabled: true },
    })
    const unknown = await post("/api/payments/pok/create-order", {
      bookingId: "does-not-exist",
    })
    check(
      `unknown booking rejected (got ${unknown.status})`,
      unknown.status === 404,
    )

    const publicSettings = await (await fetch(`${BASE}/api/settings/public`)).json()
    check("pokEnabled exposed publicly", publicSettings.pokEnabled === true)
  } finally {
    await prisma.settings.update({ where: { id: SETTINGS_ID }, data: before })
    console.log("Settings restored.")
  }
}

let failures = 0

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`)
  if (!ok) failures += 1
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (failures > 0) process.exitCode = 1
    await prisma.$disconnect()
  })
