import assert from "node:assert/strict"
import { assertPublicHost, fetchWithLimits, isPrivateAddress } from "../app/api/ai/scrape-site/route"

async function main() {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.1.1", "::", "::1", "fe80::1", "fc00::1", "fd00::1", "::ffff:127.0.0.1"]) {
    assert(isPrivateAddress(address), `${address} must be private`)
  }
  assert(!isPrivateAddress("8.8.8.8"))

  const privateLookup = async () => [{ address: "10.0.0.4", family: 4 }] as any
  await assert.rejects(() => assertPublicHost(new URL("https://example.test"), privateLookup))
  await assert.rejects(
    () => fetchWithLimits(
      "https://public.test",
      async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
      async () => [{ address: "8.8.8.8", family: 4 }] as any
    ),
    /cannot be scraped/
  )
  await assert.rejects(
    () => fetchWithLimits(
      "https://public.test",
      async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { status: 200 }),
      async () => [{ address: "8.8.8.8", family: 4 }] as any
    ),
    /larger than 2 MB/
  )

  console.log("Scraper SSRF and size-limit checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
