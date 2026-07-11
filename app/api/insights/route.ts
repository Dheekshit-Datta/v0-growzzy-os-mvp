// @ts-nocheck
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for insights (in production, use a database)
let insights = [
  {
    id: '1',
    type: 'opportunity',
    title: 'Optimization Opportunity',
    description: 'Your "Summer Sale" campaign has a high CTR of 4.2%. Consider increasing the budget by 20% to capitalize on this performance.',
    campaign: 'Summer Sale',
    priority: 'high',
    status: 'pending',
    createdAt: '2024-11-25T10:00:00Z',
    metrics: {
      ctr: 4.2,
      currentBudget: 5000,
      suggestedBudget: 6000,
      potentialIncrease: 1200
    }
  },
  {
    id: '2',
    type: 'warning',
    title: 'Attention Needed',
    description: 'Your "New Collection" campaign has a ROAS of 1.2x, below your target of 2.0x. Consider pausing underperforming ad sets.',
    campaign: 'New Collection',
    priority: 'medium',
    status: 'pending',
    createdAt: '2024-11-25T11:30:00Z',
    metrics: {
      roas: 1.2,
      targetRoas: 2.0,
      spend: 8000,
      revenue: 9600
    }
  },
  {
    id: '3',
    type: 'recommendation',
    title: 'Creative Refresh Recommended',
    description: 'Your "Evergreen" campaign ads are 14 days old. Refresh creative to maintain engagement and avoid ad fatigue.',
    campaign: 'Evergreen',
    priority: 'low',
    status: 'pending',
    createdAt: '2024-11-25T14:00:00Z',
    metrics: {
      adAge: 14,
      avgEngagement: 2.1,
      targetEngagement: 3.0
    }
  }
];

export async function GET() {
  return NextResponse.json(insights);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, insightId, campaignId, budget, note } = body;

    if (action === 'apply') {
      // Apply suggestion logic
      const insight = insights.find(i => i.id === insightId);
      if (!insight) {
        return NextResponse.json(
          { error: 'Insight not found' },
          { status: 404 }
        );
      }

      // Update insight status
      insight.status = 'applied';
      insight.appliedAt = new Date().toISOString();
      insight.note = note;

      // Simulate applying the suggestion
      let result = {};
      if (insight.type === 'opportunity' && budget) {
        result = {
          action: 'budget_increased',
          campaign: insight.campaign,
          previousBudget: insight.metrics.currentBudget,
          newBudget: budget,
          expectedImpact: '+20% reach, +15% conversions'
        };
      } else if (insight.type === 'warning') {
        result = {
          action: 'campaign_optimized',
          campaign: insight.campaign,
          changes: ['Paused underperforming ad sets', 'Reallocated budget to top performers'],
          expectedImpact: '+0.8x ROAS improvement'
        };
      } else if (insight.type === 'recommendation') {
        result = {
          action: 'creative_refresh_scheduled',
          campaign: insight.campaign,
          newCreatives: 3,
          expectedImpact: '+25% engagement, -10% CPM'
        };
      }

      return NextResponse.json({
        success: true,
        insight,
        result,
        message: `Successfully applied suggestion for ${insight.campaign}`
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { insightId, status } = body;

    const insight = insights.find(i => i.id === insightId);
    if (!insight) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      );
    }

    insight.status = status;
    if (status === 'dismissed') {
      insight.dismissedAt = new Date().toISOString();
    }

    return NextResponse.json(insight);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update insight' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing insight ID' },
        { status: 400 }
      );
    }

    const insightIndex = insights.findIndex(i => i.id === id);
    if (insightIndex === -1) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      );
    }

    const deletedInsight = insights.splice(insightIndex, 1)[0];
    return NextResponse.json(deletedInsight);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete insight' },
      { status: 500 }
    );
  }
}

