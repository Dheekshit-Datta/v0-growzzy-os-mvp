// @ts-nocheck
import jsPDF from 'jspdf';
import type { ReportInsights } from './report-analysis';

export interface ReportConfig {
  title: string;
  includeMetrics: boolean;
  includePlatformBreakdown: boolean;
  includeTopCampaigns: boolean;
  includeInsights: boolean;
  includeRecommendations: boolean;
  includeAIAnalysis?: boolean;
  dateRange?: { start: Date; end: Date };
}

export interface ReportData {
  totalSpend: number;
  totalRevenue: number;
  roas: string;
  ctr: string;
  cpc: string;
  conversions: number;
  campaigns: any[];
  leads: any[];
  platformBreakdown: Record<string, any>;
  insights?: string | ReportInsights;
  recommendations?: string;
  psychologicalInsights?: string[];
}

export class ReportBuilder {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private yPosition: number = 20;
  private config: ReportConfig;
  private data: ReportData;

  constructor(config: ReportConfig, data: ReportData) {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.config = config;
    this.data = data;
  }

  private checkPageBreak(requiredSpace: number = 30) {
    if (this.yPosition + requiredSpace > this.pageHeight - 10) {
      this.doc.addPage();
      this.yPosition = 20;
    }
  }

  private addHeader() {
    this.doc.setFontSize(24);
    this.doc.setTextColor(124, 58, 237); // Purple
    this.doc.text('GROWZZY OS', this.pageWidth / 2, this.yPosition, { align: 'center' });
    this.yPosition += 15;

    this.doc.setFontSize(16);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(this.config.title, this.pageWidth / 2, this.yPosition, { align: 'center' });
    this.yPosition += 10;

    this.doc.setFontSize(10);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(`Generated: ${new Date().toLocaleDateString()}`, this.pageWidth / 2, this.yPosition, { align: 'center' });
    this.yPosition += 20;
  }

  private addMetricsSection() {
    if (!this.config.includeMetrics) return;

    this.checkPageBreak(50);

    this.doc.setFontSize(12);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Key Performance Indicators', 20, this.yPosition);
    this.yPosition += 8;

    const kpiData = [
      ['Metric', 'Value'],
      ['Total Spend', `$${this.data.totalSpend.toFixed(2)}`],
      ['Total Revenue', `$${this.data.totalRevenue.toFixed(2)}`],
      ['ROAS', `${this.data.roas}x`],
      ['CTR', `${this.data.ctr}%`],
      ['CPC', `$${this.data.cpc}`],
      ['Conversions', this.data.conversions.toString()],
      ['Active Campaigns', this.data.campaigns.length.toString()],
    ];

    this.doc.setFontSize(9);
    let kpiY = this.yPosition;
    kpiData.forEach((row, idx) => {
      if (idx === 0) {
        this.doc.setFont(undefined, 'bold');
        this.doc.setTextColor(124, 58, 237);
      } else {
        this.doc.setFont(undefined, 'normal');
        this.doc.setTextColor(0, 0, 0);
      }
      this.doc.text(row[0], 20, kpiY);
      this.doc.text(row[1], 100, kpiY);
      kpiY += 6;
    });
    this.yPosition = kpiY + 10;
  }

  private addPlatformBreakdownSection() {
    if (!this.config.includePlatformBreakdown) return;

    this.checkPageBreak(50);

    this.doc.setFontSize(12);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Performance by Platform', 20, this.yPosition);
    this.yPosition += 8;

    this.doc.setFontSize(9);
    let platformY = this.yPosition;
    this.doc.setFont(undefined, 'bold');
    this.doc.setTextColor(124, 58, 237);
    this.doc.text('Platform', 20, platformY);
    this.doc.text('Campaigns', 70, platformY);
    this.doc.text('Spend', 110, platformY);
    this.doc.text('Revenue', 150, platformY);
    platformY += 6;

    this.doc.setFont(undefined, 'normal');
    this.doc.setTextColor(0, 0, 0);
    Object.entries(this.data.platformBreakdown).forEach(([platform, data]: [string, any]) => {
      if (platformY > this.pageHeight - 30) {
        this.doc.addPage();
        platformY = 20;
      }
      this.doc.text(platform, 20, platformY);
      this.doc.text(data.count.toString(), 70, platformY);
      this.doc.text(`$${data.spend.toFixed(2)}`, 110, platformY);
      this.doc.text(`$${data.revenue.toFixed(2)}`, 150, platformY);
      platformY += 6;
    });
    this.yPosition = platformY + 10;
  }

  private addTopCampaignsSection() {
    if (!this.config.includeTopCampaigns || this.data.campaigns.length === 0) return;

    this.checkPageBreak(40);

    this.doc.setFontSize(12);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Top Performing Campaigns', 20, this.yPosition);
    this.yPosition += 8;

    this.doc.setFontSize(9);
    let campaignY = this.yPosition;
    this.doc.setFont(undefined, 'bold');
    this.doc.setTextColor(124, 58, 237);
    this.doc.text('Campaign', 20, campaignY);
    this.doc.text('Platform', 80, campaignY);
    this.doc.text('Revenue', 130, campaignY);
    campaignY += 6;

    this.doc.setFont(undefined, 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.data.campaigns.slice(0, 5).forEach((campaign: any) => {
      if (campaignY > this.pageHeight - 30) {
        this.doc.addPage();
        campaignY = 20;
      }
      this.doc.text(campaign.name, 20, campaignY);
      this.doc.text(campaign.platform, 80, campaignY);
      this.doc.text(`$${(campaign.revenue || 0).toFixed(2)}`, 130, campaignY);
      campaignY += 6;
    });
    this.yPosition = campaignY + 10;
  }

  private addAIAnalysisSection() {
    if (!this.config.includeAIAnalysis || !this.data.insights) return;

    const insights = typeof this.data.insights === 'string' 
      ? JSON.parse(this.data.insights) 
      : this.data.insights as ReportInsights;

    this.checkPageBreak(50);
    this.doc.setFontSize(14);
    this.doc.setTextColor(124, 58, 237);
    this.doc.text('AI-Powered Analysis', 20, this.yPosition);
    this.yPosition += 10;

    // Executive Summary
    this.doc.setFontSize(11);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont(undefined, 'bold');
    this.doc.text('Executive Summary', 20, this.yPosition);
    this.yPosition += 6;

    this.doc.setFontSize(9);
    this.doc.setFont(undefined, 'normal');
    
    // Key Wins
    this.doc.setTextColor(76, 175, 80);
    this.doc.text('Key Wins:', 20, this.yPosition);
    this.yPosition += 4;
    insights.executiveSummary.keyWins.forEach(win => {
      this.checkPageBreak(8);
      const lines = this.doc.splitTextToSize(`• ${win}`, this.pageWidth - 40);
      lines.forEach(line => {
        this.doc.text(line, 25, this.yPosition);
        this.yPosition += 4;
      });
    });
    
    this.yPosition += 2;

    // Areas of Concern
    this.doc.setTextColor(244, 67, 54);
    this.doc.text('Areas of Concern:', 20, this.yPosition);
    this.yPosition += 4;
    insights.executiveSummary.areasOfConcern.forEach(concern => {
      this.checkPageBreak(8);
      const lines = this.doc.splitTextToSize(`• ${concern}`, this.pageWidth - 40);
      lines.forEach(line => {
        this.doc.text(line, 25, this.yPosition);
        this.yPosition += 4;
      });
    });

    this.yPosition += 3;
  }

  private addPerformanceAnalysisSection() {
    if (!this.config.includeAIAnalysis || !this.data.insights) return;

    const insights = typeof this.data.insights === 'string' 
      ? JSON.parse(this.data.insights) 
      : this.data.insights as ReportInsights;

    this.checkPageBreak(40);

    this.doc.setFontSize(11);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont(undefined, 'bold');
    this.doc.text('Performance Analysis', 20, this.yPosition);
    this.yPosition += 6;

    this.doc.setFontSize(9);
    this.doc.setFont(undefined, 'normal');
    
    const sections = [
      { title: 'ROAS Analysis', content: insights.performanceAnalysis.roasAnalysis },
      { title: 'Platform Performance', content: insights.performanceAnalysis.platformPerformance },
      { title: 'Conversion Analysis', content: insights.performanceAnalysis.conversionAnalysis },
    ];

    sections.forEach(section => {
      this.checkPageBreak(20);
      this.doc.setFont(undefined, 'bold');
      this.doc.setTextColor(124, 58, 237);
      this.doc.text(section.title, 20, this.yPosition);
      this.yPosition += 4;

      this.doc.setFont(undefined, 'normal');
      this.doc.setTextColor(50, 50, 50);
      const lines = this.doc.splitTextToSize(section.content, this.pageWidth - 40);
      lines.forEach(line => {
        if (this.yPosition > this.pageHeight - 20) {
          this.doc.addPage();
          this.yPosition = 20;
        }
        this.doc.text(line, 20, this.yPosition);
        this.yPosition += 4;
      });
      this.yPosition += 3;
    });
  }

  private addRecommendationsSection() {
    if (!this.config.includeRecommendations || !this.data.insights) return;

    const insights = typeof this.data.insights === 'string' 
      ? JSON.parse(this.data.insights) 
      : this.data.insights as ReportInsights;

    this.checkPageBreak(40);

    this.doc.setFontSize(12);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont(undefined, 'bold');
    this.doc.text('Prioritized Recommendations', 20, this.yPosition);
    this.yPosition += 8;

    this.doc.setFontSize(9);
    insights.recommendations.forEach((rec, idx) => {
      this.checkPageBreak(20);
      
      // Priority color
      const priorityColor = rec.priority === 'high' ? [244, 67, 54] : rec.priority === 'medium' ? [255, 193, 7] : [76, 175, 80];
      this.doc.setTextColor(...priorityColor);
      this.doc.setFont(undefined, 'bold');
      this.doc.text(`${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`, 20, this.yPosition);
      this.yPosition += 5;

      this.doc.setFont(undefined, 'normal');
      this.doc.setTextColor(50, 50, 50);
      const descLines = this.doc.splitTextToSize(`${rec.description}`, this.pageWidth - 40);
      descLines.forEach(line => {
        this.doc.text(line, 25, this.yPosition);
        this.yPosition += 4;
      });

      this.doc.setTextColor(100, 100, 100);
      this.doc.setFont(undefined, 'italic');
      this.doc.text(`Expected Impact: ${rec.estimatedImpact}`, 25, this.yPosition);
      this.yPosition += 5;
    });
  }

  private addPsychologicalInsightsSection() {
    if (!this.data.psychologicalInsights || this.data.psychologicalInsights.length === 0) return;

    this.checkPageBreak(40);

    this.doc.setFontSize(12);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont(undefined, 'bold');
    this.doc.text('Audience Psychology & Behavior', 20, this.yPosition);
    this.yPosition += 8;

    this.doc.setFontSize(9);
    this.doc.setFont(undefined, 'normal');
    this.doc.setTextColor(50, 50, 50);

    this.data.psychologicalInsights.forEach((insight, idx) => {
      this.checkPageBreak(12);
      const lines = this.doc.splitTextToSize(`${idx + 1}. ${insight}`, this.pageWidth - 40);
      lines.forEach(line => {
        this.doc.text(line, 20, this.yPosition);
        this.yPosition += 4;
      });
      this.yPosition += 2;
    });
  }

  build(): jsPDF {
    this.addHeader();
    this.addMetricsSection();
    this.addPlatformBreakdownSection();
    this.addTopCampaignsSection();
    
    if (this.config.includeAIAnalysis) {
      this.addAIAnalysisSection();
      this.addPerformanceAnalysisSection();
      this.addRecommendationsSection();
      this.addPsychologicalInsightsSection();
    }

    return this.doc;
  }

  getBuffer(): Buffer {
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  download(filename: string) {
    this.doc.save(filename);
  }
}
