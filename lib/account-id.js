export function normalizeAccountId(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^act_/, "")
        .replace(/[-\s]/g, "");
}
export function accountIdVariants(value) {
    const raw = String(value || "").trim();
    const normalized = normalizeAccountId(raw);
    if (!raw && !normalized)
        return [];
    const variants = new Set();
    if (raw)
        variants.add(raw);
    if (normalized) {
        variants.add(normalized);
        variants.add(`act_${normalized}`);
        if (/^\d{10}$/.test(normalized)) {
            variants.add(`${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`);
        }
    }
    return Array.from(variants);
}
