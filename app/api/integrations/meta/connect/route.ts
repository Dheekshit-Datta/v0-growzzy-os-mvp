import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    { error: "Only Google Ads OAuth is supported in this pass." },
    { status: 400 }
  )
}
