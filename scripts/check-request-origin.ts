import assert from "node:assert/strict"
import { isAllowedBrowserMutation } from "../lib/request-origin"

const base = { method: "POST", pathname: "/api/campaigns", requestOrigin: "https://growzzyos.vercel.app" }
assert.equal(isAllowedBrowserMutation({ ...base, originHeader: "https://growzzyos.vercel.app", fetchSite: "same-origin" }), true)
assert.equal(isAllowedBrowserMutation({ ...base, originHeader: "https://evil.example", fetchSite: "cross-site" }), false)
assert.equal(isAllowedBrowserMutation({ ...base, originHeader: "not a url", fetchSite: "cross-site" }), false)
assert.equal(isAllowedBrowserMutation({ ...base, originHeader: null, fetchSite: "cross-site" }), false)
assert.equal(isAllowedBrowserMutation({ ...base, originHeader: null, fetchSite: null }), true)
assert.equal(isAllowedBrowserMutation({ ...base, pathname: "/api/cron/sync", originHeader: "https://evil.example" }), true)
assert.equal(isAllowedBrowserMutation({ ...base, pathname: "/api/webhooks/google-leads", originHeader: "https://evil.example" }), true)
assert.equal(isAllowedBrowserMutation({ ...base, method: "GET", originHeader: "https://evil.example" }), true)
console.log("Request origin checks passed")
