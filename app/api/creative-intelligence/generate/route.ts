import { NextRequest } from "next/server"
import { POST as generateCreatives } from "@/app/api/ai/generate-creatives/route"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  return generateCreatives(req)
}
