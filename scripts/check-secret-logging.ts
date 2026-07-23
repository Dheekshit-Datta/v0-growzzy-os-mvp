import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const files = execFileSync("rg", ["--files", "app/api", "lib", "services", "-g", "*.ts", "-g", "*.tsx"], {
  encoding: "utf8",
})
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)

const rawConsoleAllowlist = new Set(["lib\\logger.ts", "lib\\prisma.ts", "lib\\crypto.ts"])
const rawConsole = files.filter((file) => !rawConsoleAllowlist.has(file) && /console\.(log|warn|error)\(/.test(readFileSync(file, "utf8")))
assert.deepEqual(rawConsole, [], `Raw server console calls:\n${rawConsole.join("\n")}`)

const sensitiveLogExpressions: string[] = []
for (const file of files) {
  const source = readFileSync(file, "utf8")
  let start = 0
  while ((start = source.indexOf("log(", start)) >= 0) {
    let depth = 0
    let quote = ""
    let escaped = false
    let end = start + 3

    for (; end < source.length; end += 1) {
      const char = source[end]
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (quote) {
        if (char === quote) quote = ""
        continue
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char
        continue
      }
      if (char === "(") depth += 1
      if (char === ")" && --depth === 0) break
    }

    const call = source.slice(start, end + 1)
    if (/[{,]\s*(accessToken|refreshToken|client_secret|developerToken|authorization)\s*[:,}]/i.test(call)) {
      sensitiveLogExpressions.push(`${file}:${source.slice(0, start).split("\n").length}`)
    }
    start = end + 1
  }
}

assert.deepEqual(sensitiveLogExpressions, [], `Sensitive values passed to logger:\n${sensitiveLogExpressions.join("\n")}`)
console.log(`Secret-logging checks passed (${files.length} server files)`)
