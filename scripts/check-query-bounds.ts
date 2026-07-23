import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const files = execFileSync("rg", ["-l", "findMany\\(", "app/api", "--glob", "route.ts"], { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)

const unbounded: string[] = []

for (const file of files) {
  const source = readFileSync(file, "utf8")
  let call = 0

  while ((call = source.indexOf("findMany(", call)) >= 0) {
    const start = source.indexOf("{", call)
    let depth = 0
    let hasTopLevelTake = false
    let end = start

    for (; end < source.length; end += 1) {
      if (source[end] === "{") depth += 1
      if (depth === 1 && source.slice(end).match(/^take\s*:/)) hasTopLevelTake = true
      if (source[end] === "}" && --depth === 0) break
    }

    if (!hasTopLevelTake) {
      const line = source.slice(0, call).split("\n").length
      unbounded.push(`${file}:${line}`)
    }
    call = end + 1
  }
}

assert.deepEqual(unbounded, [], `Unbounded API findMany calls:\n${unbounded.join("\n")}`)
console.log(`Query-bound checks passed (${files.length} route files)`)
