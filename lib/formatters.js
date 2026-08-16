export function formatCurrency(value, decimals = 2) {
    if (!Number.isFinite(Number(value)))
        return "$0.00";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(Number(value));
}
export function formatCompactNumber(value) {
    if (!Number.isFinite(Number(value)))
        return "0";
    return new Intl.NumberFormat("en-US").format(Number(value));
}
export function formatPercent(value, decimals = 2) {
    if (!Number.isFinite(Number(value)))
        return "0.00%";
    return `${Number(value).toFixed(decimals)}%`;
}
export function formatRoas(value, decimals = 1) {
    if (!Number.isFinite(Number(value)))
        return "0.0x";
    return `${Number(value).toFixed(decimals)}x`;
}
export function formatDateLabel(value) {
    if (!value)
        return "Never";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return "Never";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export function formatRelativeTime(value) {
    if (!value)
        return "Never synced";
    const date = value instanceof Date ? value : new Date(value);
    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs) || Number.isNaN(diffMs))
        return "Never synced";
    if (diffMs < 60000)
        return "Just now";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60)
        return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
}
