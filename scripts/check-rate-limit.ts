import assert from "node:assert/strict"
import { rateLimit, rateLimitError } from "../lib/rate-limit"

async function main() {
  const live = process.argv.includes("--live")
  if (live) {
    assert.ok(process.env.UPSTASH_REDIS_REST_URL)
    assert.ok(process.env.UPSTASH_REDIS_REST_TOKEN)
    const key = `live-self-check:${crypto.randomUUID()}`
    const first = await rateLimit(key, 1, 60_000, { strict: true })
    const second = await rateLimit(key, 1, 60_000, { strict: true })
    assert.equal(first.allowed, true)
    assert.equal(second.allowed, false)
    assert.equal(second.unavailable, undefined)
    console.log("live Upstash sliding-window checks passed")
    return
  }

  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN

  const first = await rateLimit("self-check", 1, 60_000)
  const second = await rateLimit("self-check", 1, 60_000)
  const strict = await rateLimit("strict-self-check", 1, 60_000, { strict: true })

  assert.equal(first.allowed, true)
  assert.equal(second.allowed, false)
  assert.equal(strict.allowed, false)
  assert.equal(strict.unavailable, true)
  assert.equal(rateLimitError(strict).status, 503)
  console.log("rate-limit checks passed")
}

main()
