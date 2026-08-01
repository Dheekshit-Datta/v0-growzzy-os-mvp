import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync("lib/workspace.ts", "utf8")

assert.match(source, /if \(explicitWorkspaceId\) throw error/)
assert.match(source, /return getPrimaryWorkspaceId\(userId\)/)
assert.match(source, /explicitWorkspaceId \|\| getWorkspaceIdFromCookie\(request\)/)

console.log("stale workspace cookies fall back; explicit workspace access stays strict")
