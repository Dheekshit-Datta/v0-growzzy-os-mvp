function rollingAverage(points, index, metric, window = 5) {
    const start = Math.max(0, index - window);
    const slice = points.slice(start, index);
    if (!slice.length)
        return 0;
    return slice.reduce((sum, point) => sum + Number(point[metric] || 0), 0) / slice.length;
}
export function detectAlerts(data) {
    const alerts = [];
    for (let i = 1; i < data.length; i += 1) {
        const point = data[i];
        const avgReach = rollingAverage(data, i, "reach", 5);
        const avgSpend = rollingAverage(data, i, "spend", 5);
        const avgCtr = rollingAverage(data, i, "ctr", 5);
        if (avgReach > 0 && point.reach > avgReach * 2) {
            alerts.push({
                id: `${point.platform}-reach-${point.timestamp}`,
                metric: "reach",
                platform: point.platform,
                value: point.reach,
                threshold: Number((avgReach * 2).toFixed(2)),
                severity: point.reach > avgReach * 3 ? "CRITICAL" : "WARNING",
                detectedAt: point.timestamp,
                description: `Reach spiked ${((point.reach / avgReach) || 0).toFixed(2)}x above rolling average.`,
            });
        }
        if (avgSpend > 0 && point.spend > avgSpend * 1.5) {
            alerts.push({
                id: `${point.platform}-spend-${point.timestamp}`,
                metric: "spend",
                platform: point.platform,
                value: point.spend,
                threshold: Number((avgSpend * 1.5).toFixed(2)),
                severity: point.spend > avgSpend * 2 ? "CRITICAL" : "WARNING",
                detectedAt: point.timestamp,
                description: `Spend increased to ${point.spend.toFixed(2)} (${(point.spend / avgSpend).toFixed(2)}x above average).`,
            });
        }
        if (avgCtr > 0 && point.ctr < avgCtr * 0.6) {
            alerts.push({
                id: `${point.platform}-ctr-${point.timestamp}`,
                metric: "ctr",
                platform: point.platform,
                value: point.ctr,
                threshold: Number((avgCtr * 0.6).toFixed(2)),
                severity: point.ctr < avgCtr * 0.45 ? "CRITICAL" : "WARNING",
                detectedAt: point.timestamp,
                description: `CTR dropped ${(((avgCtr - point.ctr) / avgCtr) * 100).toFixed(1)}% below rolling average.`,
            });
        }
        if (point.botScore > 50) {
            alerts.push({
                id: `${point.platform}-bot-${point.timestamp}`,
                metric: "botScore",
                platform: point.platform,
                value: point.botScore,
                threshold: 50,
                severity: point.botScore > 70 ? "CRITICAL" : "INFO",
                detectedAt: point.timestamp,
                description: `Bot score elevated at ${point.botScore.toFixed(1)}. Review traffic quality.`,
            });
        }
    }
    return alerts.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
}
