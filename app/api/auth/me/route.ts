import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/resolve-user'
import { isAllowedProfileImage } from '@/lib/profile-avatars'
import { requestPassesSameOrigin } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true },
    })
    return NextResponse.json({ user })
  } catch (err) {
    console.error('[api/auth/me] fatal error:', err)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}

const ProfileSchema = z.object({
  image: z.string().max(1_050_000).refine(isAllowedProfileImage, "Choose a provided avatar or upload a PNG, JPEG, or WebP image."),
})

export async function PATCH(req: NextRequest) {
  if (!requestPassesSameOrigin(req)) return NextResponse.json({ ok: false, error: { code: 'CROSS_ORIGIN_MUTATION', message: 'Cross-origin mutation blocked.' } }, { status: 403 })
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = ProfileSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid profile image" }, { status: 400 })

  const userId = await resolveUserId(session.user.id)
  const user = await prisma.user.update({
    where: { id: userId },
    data: { image: parsed.data.image || null },
    select: { id: true, name: true, email: true, image: true },
  })
  return NextResponse.json({ ok: true, user })
}
