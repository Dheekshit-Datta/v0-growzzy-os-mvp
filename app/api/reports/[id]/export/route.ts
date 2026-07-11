import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/resolve-user'
import { getRequestWorkspaceId, workspaceWhere } from '@/lib/workspace'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Mock window for jspdf to work in Node.js
if (typeof window === 'undefined') {
    global.window = {} as any
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const userId = await resolveUserId(session.user.id)
        const workspaceId = await getRequestWorkspaceId(userId, request as any)

        const reportId = params.id

        const report = await prisma.report.findFirst({
            where: { id: reportId, userId, ...workspaceWhere(workspaceId, false) },
        })

        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 })
        }

        // Create PDF
        const doc = new jsPDF()

        // Report Title
        doc.setFontSize(20)
        doc.text(report.name, 14, 22)

        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)

        // Executive Summary
        if (report.aiSummary) {
            doc.setFontSize(14)
            doc.setTextColor(0)
            doc.text("Executive Summary", 14, 45)

            doc.setFontSize(10)
            doc.setTextColor(50)
            const splitSummary = doc.splitTextToSize(report.aiSummary, 180)
            doc.text(splitSummary, 14, 55)
        }

        // Metrics Table
        if (report.data) {
            const data: any = report.data
            const startY = report.aiSummary ? 100 : 50

            doc.setFontSize(14)
            doc.setTextColor(0)
            doc.text("Performance Metrics", 14, startY - 5)

            // Prepare table data
            const head = [['Metric', 'Value']]
            const body = [
                ['Total Spend', `$${data.totals?.spend?.toFixed(2) || '0.00'}`],
                ['Total Revenue', `$${data.totals?.revenue?.toFixed(2) || '0.00'}`],
                ['ROAS', `${data.totals?.roas?.toFixed(2) || '0.00'}x`],
                ['Conversions', `${data.totals?.conversions || 0}`],
                ['Leads', `${data.totals?.leads || 0}`],
                ['CPC', `$${data.totals?.cpc?.toFixed(2) || '0.00'}`]
            ]

            autoTable(doc, {
                startY: startY,
                head: head,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [66, 66, 66] }
            })
        }

        // Return PDF
        const pdfBuffer = doc.output('arraybuffer')

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${report.name.replace(/\s+/g, '_')}.pdf"`
            }
        })

    } catch (error: any) {
        console.error('[PDF Export] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
