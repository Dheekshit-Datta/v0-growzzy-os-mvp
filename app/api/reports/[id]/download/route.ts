import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/resolve-user";
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace";
import { ComprehensiveReportBuilder } from "@/lib/comprehensive-report-builder";
import type { ReportMetrics } from "@/lib/report-metrics";
import type { AIReportInsights } from "@/lib/report-insights";
import type { ActionPlan } from "@/lib/report-action-plan";
import { log } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }
    const userId = await resolveUserId(session.user.id);
    const workspaceId = await getRequestWorkspaceId(userId, req as any);

    const { id } = params;

    // Fetch report from Prisma
    const report = await prisma.report.findUnique({
      where: {
        id,
        userId,
        ...workspaceWhere(workspaceId, false),
      },
    });

    if (!report) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Report not found' } }, { status: 404 });
    }

    // Parse stored data
    // In our implementation, we store these as Json in Prisma, so they might already be parsed or need double checking
    const metrics = (report.metrics as unknown) as ReportMetrics;
    const insights = (report.insights as unknown) as AIReportInsights;
    const actionPlan = (report.recommendations as unknown) as ActionPlan;

    if (!metrics || !insights || !actionPlan) {
      return NextResponse.json({ ok: false, error: { code: 'DATA_MISSING', message: 'Report data is incomplete' } }, { status: 400 });
    }

    // Generate report ID for the header
    const reportId = `RPT-${new Date(report.createdAt).getFullYear()}-${id.substring(0, 6).toUpperCase()}`;

    // Build PDF
    // Ensure dates are actual Date objects if report-metrics expects them
    if (metrics.dateRange) {
      metrics.dateRange.from = new Date(metrics.dateRange.from);
      metrics.dateRange.to = new Date(metrics.dateRange.to);
    }

    const pdfBuilder = new ComprehensiveReportBuilder(metrics, insights, actionPlan, reportId);
    pdfBuilder.build();
    const pdfBuffer = pdfBuilder.getBuffer();

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(report.name || "report").replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (error: any) {
    log("error", "reports/download", "PDF generation failed", { message: error?.message || "Unknown error" });
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: "Failed to generate PDF. Please ensure the report data is complete." } },
      { status: 500 }
    );
  }
}
