// @ts-nocheck
import jsPDF from "jspdf";
import type { ReportMetrics } from "./report-metrics";
import type { AIReportInsights } from "./report-insights";
import type { ActionPlan } from "./report-action-plan";

export class ComprehensiveReportBuilder {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private yPosition: number = 20;
  private metrics: ReportMetrics;
  private insights: AIReportInsights;
  private actionPlan: ActionPlan;
  private reportId: string;
  private generatedAt: Date;

  constructor(
    metrics: ReportMetrics,
    insights: AIReportInsights,
    actionPlan: ActionPlan,
    reportId: string
  ) {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.metrics = metrics;
    this.insights = insights;
    this.actionPlan = actionPlan;
    this.reportId = reportId;
    this.generatedAt = new Date();
  }

  private checkPageBreak(requiredSpace: number = 30) {
    if (this.yPosition + requiredSpace > this.pageHeight - 10) {
      this.doc.addPage();
      this.yPosition = 20;
    }
  }

  private addTitle(text: string, size: number = 24) {
    this.checkPageBreak(10);
    this.doc.setFontSize(size);
    this.doc.setTextColor(124, 58, 237);
    this.doc.text(text, this.pageWidth / 2, this.yPosition, { align: "center" });
    this.yPosition += 10;
  }

  private addSectionTitle(text: string) {
    this.checkPageBreak(8);
    this.doc.setFontSize(14);
    this.doc.setTextColor(124, 58, 237);
    this.doc.setFont(undefined, "bold");
    this.doc.text(text, 20, this.yPosition);
    this.yPosition += 8;
  }

  private addSubsectionTitle(text: string) {
    this.checkPageBreak(6);
    this.doc.setFontSize(11);
    this.doc.setTextColor(60, 60, 60);
    this.doc.setFont(undefined, "bold");
    this.doc.text(text, 20, this.yPosition);
    this.yPosition += 6;
  }

  private addParagraph(text: string, indent: number = 0) {
    this.doc.setFontSize(9);
    this.doc.setTextColor(40, 40, 40);
    this.doc.setFont(undefined, "normal");
    const lines = this.doc.splitTextToSize(text, this.pageWidth - 40 - indent);
    lines.forEach((line) => {
      this.checkPageBreak(5);
      this.doc.text(line, 20 + indent, this.yPosition);
      this.yPosition += 4;
    });
  }

  private addBulletPoint(text: string, indent: number = 0) {
    this.doc.setFontSize(9);
    this.doc.setTextColor(40, 40, 40);
    this.doc.setFont(undefined, "normal");
    const lines = this.doc.splitTextToSize(text, this.pageWidth - 50 - indent);
    lines.forEach((line, idx) => {
      this.checkPageBreak(5);
      if (idx === 0) {
        this.doc.text(`• ${line}`, 25 + indent, this.yPosition);
      } else {
        this.doc.text(line, 25 + indent, this.yPosition);
      }
      this.yPosition += 4;
    });
  }

  private addMetricsGrid(metrics: Record<string, string>) {
    this.checkPageBreak(30);
    const keys = Object.keys(metrics);
    const cols = 2;
    const colWidth = (this.pageWidth - 40) / cols;

    let row = 0;
    let col = 0;

    keys.forEach((key, idx) => {
      const x = 20 + col * colWidth;
      const y = this.yPosition + row * 12;

      if (y > this.pageHeight - 30) {
        this.doc.addPage();
        this.yPosition = 20;
        row = 0;
        col = 0;
      }

      this.doc.setFontSize(8);
      this.doc.setTextColor(100, 100, 100);
      this.doc.setFont(undefined, "normal");
      this.doc.text(key, x, y);

      this.doc.setFontSize(10);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont(undefined, "bold");
      this.doc.text(metrics[key], x, y + 5);

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    });

    this.yPosition += Math.ceil(keys.length / cols) * 12 + 5;
  }

  private addCampaignsTable(campaigns: any[]) {
    this.checkPageBreak(40);

    const columns = ["Campaign Name", "Platform", "Spend", "Revenue", "ROAS"];
    const colWidths = [50, 30, 25, 30, 25];
    const startX = 20;
    let currentY = this.yPosition;

    // Header
    this.doc.setFontSize(9);
    this.doc.setFont(undefined, "bold");
    this.doc.setTextColor(124, 58, 237);
    let currentX = startX;
    columns.forEach((col, idx) => {
      this.doc.text(col, currentX, currentY);
      currentX += colWidths[idx];
    });

    currentY += 6;
    this.yPosition = currentY;

    // Rows
    this.doc.setFont(undefined, "normal");
    this.doc.setTextColor(40, 40, 40);

    campaigns.slice(0, 8).forEach((campaign) => {
      this.checkPageBreak(6);
      currentX = startX;

      // Campaign name (truncated)
      const name = campaign.name.substring(0, 25);
      this.doc.text(name, currentX, this.yPosition);
      currentX += colWidths[0];

      // Platform
      this.doc.text(campaign.platform, currentX, this.yPosition);
      currentX += colWidths[1];

      // Spend
      this.doc.text(`$${(campaign.spend || 0).toFixed(0)}`, currentX, this.yPosition);
      currentX += colWidths[2];

      // Revenue
      this.doc.text(`$${(campaign.revenue || 0).toFixed(0)}`, currentX, this.yPosition);
      currentX += colWidths[3];

      // ROAS
      this.doc.text(`${(campaign.roas || 0).toFixed(2)}x`, currentX, this.yPosition);

      this.yPosition += 5;
    });

    this.yPosition += 5;
  }

  build(): jsPDF {
    // Cover page
    this.addTitle("GROWZZY OS", 32);
    this.yPosition += 10;

    this.addTitle("Performance Report", 24);
    this.yPosition += 8;

    this.doc.setFontSize(10);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(
      `${this.metrics.dateRange.from.toLocaleDateString()} - ${this.metrics.dateRange.to.toLocaleDateString()}`,
      this.pageWidth / 2,
      this.yPosition,
      { align: "center" }
    );
    this.yPosition += 20;

    // Quick stats
    this.addMetricsGrid({
      "Total Spend": `$${this.metrics.totalSpend.toFixed(0)}`,
      "Total Revenue": `$${this.metrics.totalRevenue.toFixed(0)}`,
      "Overall ROAS": `${this.metrics.averageROAS.toFixed(2)}x`,
      "Conversions": this.metrics.totalConversions.toString(),
      "CTR": `${this.metrics.averageCTR.toFixed(2)}%`,
      "CPC": `$${this.metrics.averageCPC.toFixed(2)}`,
    });

    // Page 2: Executive Summary
    this.doc.addPage();
    this.yPosition = 20;

    this.addSectionTitle("Executive Summary");
    this.yPosition += 4;

    this.addSubsectionTitle("Key Wins");
    this.insights.wins.forEach((win) => {
      this.addBulletPoint(win);
    });

    this.yPosition += 6;

    this.addSubsectionTitle("Areas of Concern");
    this.insights.concerns.forEach((concern) => {
      this.addBulletPoint(concern);
    });

    // Page 3: Top Campaigns
    this.doc.addPage();
    this.yPosition = 20;

    this.addSectionTitle("Campaign Performance");
    this.yPosition += 4;

    this.addSubsectionTitle("Top Performing Campaigns");
    this.addCampaignsTable(this.metrics.topCampaigns);

    // Page 4: Recommendations
    this.doc.addPage();
    this.yPosition = 20;

    this.addSectionTitle("Recommendations");
    this.yPosition += 4;

    this.insights.recommendations.forEach((rec, idx) => {
      this.addSubsectionTitle(`${idx + 1}. ${rec.title}`);
      this.addParagraph(`Reasoning: ${rec.reasoning}`, 5);
      this.yPosition += 2;
      this.addParagraph(`Projected Impact: ${rec.projectedImpact}`, 5);
      this.yPosition += 2;
      this.addParagraph(`Confidence Level: ${(rec.confidence * 100).toFixed(0)}%`, 5);
      this.yPosition += 4;
    });

    // Page 5+: Action Plan
    this.doc.addPage();
    this.yPosition = 20;

    this.addSectionTitle("Next Month Action Plan");
    this.addParagraph(this.actionPlan.month);
    this.yPosition += 6;

    this.actionPlan.weeks.forEach((week) => {
      this.addSubsectionTitle(week.title);
      week.actions.forEach((action) => {
        this.addBulletPoint(action);
      });
      this.yPosition += 3;
    });

    // Final page: Info
    this.doc.addPage();
    this.yPosition = 20;

    this.addSectionTitle("Report Information");
    this.yPosition += 10;

    this.addParagraph(`Report ID: ${this.reportId}`);
    this.yPosition += 4;
    this.addParagraph(`Generated: ${this.generatedAt.toLocaleString()}`);
    this.yPosition += 4;
    this.addParagraph("Generated by GROWZZY OS AI Engine");

    return this.doc;
  }

  getBuffer(): Buffer {
    return Buffer.from(this.doc.output("arraybuffer"));
  }

  download(filename: string) {
    this.doc.save(filename);
  }
}
