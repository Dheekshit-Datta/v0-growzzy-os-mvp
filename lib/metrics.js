export function deriveMetrics(input) {
    const ctr = input.impressions > 0 ? input.clicks / input.impressions : 0;
    const cpa = input.conversions > 0 ? input.spend / input.conversions : null;
    const roas = input.revenue && input.spend > 0 ? input.revenue / input.spend : null;
    return { ctr, cpa, roas };
}
