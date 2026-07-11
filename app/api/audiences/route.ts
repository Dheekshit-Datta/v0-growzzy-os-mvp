export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'

// TODO: Full audiences model in Prisma schema. For now, return empty.

const AudienceSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['lookalike', 'interest', 'behavior', 'retargeting', 'zero_party']),
  definition: z.record(z.any()),
  size_estimate: z.number().int().positive().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
    }
    // Placeholder — audiences are not yet in the Prisma schema
    return NextResponse.json({ ok: true, data: { audiences: [] } })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
    }
    const body = await request.json()
    const parse = AudienceSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', details: parse.error.flatten().fieldErrors } }, { status: 400 })
    }
    // Placeholder — create would go to Prisma
    return NextResponse.json({ ok: true, data: { audience: { id: `aud_${Date.now()}`, ...parse.data } } }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
  }
}
