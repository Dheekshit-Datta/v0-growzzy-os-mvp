import { NextResponse } from "next/server"
import { jsPDF } from "jspdf"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getRequestWorkspaceId } from "@/lib/workspace"

function text(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => `• ${String(item)}`).join("\n")
  return value ? String(value) : "Not researched yet"
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const workspaceId = await getRequestWorkspaceId(session.user.id, request as any)
  const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, members: { some: { userId: session.user.id } } } })
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })

  const research = (workspace.brandResearch || {}) as Record<string, unknown>
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 48
  let y = 56
  const writeSection = (heading: string, value: unknown) => {
    if (y > 760) { doc.addPage(); y = 56 }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(heading, margin, y); y += 20
    doc.setFont("helvetica", "normal"); doc.setFontSize(10)
    const lines = doc.splitTextToSize(text(value), 500)
    doc.text(lines, margin, y); y += Math.max(34, lines.length * 14 + 18)
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text(`${workspace.name} — My Brand Research`, margin, y); y += 20
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Generated ${new Date().toLocaleString()} · Source-backed research snapshot`, margin, y); y += 34
  writeSection("Business model", research.businessModel || workspace.productDescription)
  writeSection("Ideal customer profile", research.icp)
  writeSection("Competitors", research.competitors)
  writeSection("Keywords", research.keywords)
  writeSection("Verified findings", research.verifiedFindings)
  writeSection("Inferences", research.inferences)
  writeSection("Citations", research.citations)

  const buffer = Buffer.from(doc.output("arraybuffer"))
  return new NextResponse(buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${workspace.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-brand-research.pdf"`, "Cache-Control": "no-store" } })
}
