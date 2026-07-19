import assert from "node:assert/strict"
import { CURATED_AVATARS, isAllowedProfileImage } from "../lib/profile-avatars"

assert.equal(isAllowedProfileImage(CURATED_AVATARS[0]), true)
assert.equal(isAllowedProfileImage("data:image/png;base64,aGVsbG8="), true)
assert.equal(isAllowedProfileImage("data:image/svg+xml;base64,PHN2Zz4="), false)
assert.equal(isAllowedProfileImage("https://example.com/avatar.png"), false)

console.log("Profile image validation passed")
