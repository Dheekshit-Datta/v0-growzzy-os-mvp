import { NextRequest, NextResponse } from "next/server"
import { handlers } from "@/lib/auth"

export const POST = handlers.POST

export function GET(req: NextRequest) {
  const url = new URL("/auth", req.url)
  url.searchParams.set("mode", "signin")
  return NextResponse.redirect(url)
}
