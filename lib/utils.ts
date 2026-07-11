// <CHANGE> Using inline clsx implementation to avoid module loading issues
import { twMerge } from "tailwind-merge"

type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | ClassValue[]
  | { [key: string]: boolean | undefined | null }

function clsx(...inputs: ClassValue[]): string {
  let result = ""
  for (const input of inputs) {
    if (!input) continue
    if (typeof input === "string" || typeof input === "number") {
      result += (result ? " " : "") + input
    } else if (Array.isArray(input)) {
      const inner = clsx(...input)
      if (inner) result += (result ? " " : "") + inner
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) result += (result ? " " : "") + key
      }
    }
  }
  return result
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}
