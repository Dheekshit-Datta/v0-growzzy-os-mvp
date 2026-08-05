import { prisma } from "@/lib/prisma"

// Business context service with caching and invalidation
// This service retrieves and caches business context from workspace data

let contextCache: Record<string, { data: string; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get business context for a workspace with caching
 * @param workspaceId - The workspace ID
 * @returns Business context string
 */
export async function getBusinessContextForWorkspace(workspaceId: string): Promise<string> {
  // Check cache first
  const cached = contextCache[workspaceId];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // If not in cache or expired, fetch fresh context
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      websiteUrl: true,
      primaryGoal: true,
      currencyCode: true,
      timezone: true,
      productDescription: true,
      industry: true,
      toneOfVoice: true,
      dailyBudgetCeiling: true,
    },
  })

  if (!workspace) {
    contextCache[workspaceId] = { data: "", timestamp: Date.now() };
    return "";
  }

  let websiteSummary: string | null = null;

  if (workspace?.websiteUrl) {
    try {
      // Fetch and summarize website content
      websiteSummary = await summarizeWebsite(workspace.websiteUrl);
    } catch (error) {
      console.warn(`Failed to scrape website ${workspace.websiteUrl}:`, error);
    }
  }

  // Format the final context string
  const details = [
    workspace.name && `Business: ${workspace.name}`,
    workspace.productDescription && `Confirmed business summary: ${workspace.productDescription}`,
    workspace.websiteUrl && `Website: ${workspace.websiteUrl}`,
    websiteSummary && `Website analysis: ${websiteSummary}`,
    workspace.industry && `Industry: ${workspace.industry}`,
    workspace.toneOfVoice && `Preferred voice: ${workspace.toneOfVoice}`,
    workspace.primaryGoal && `Primary goal: ${workspace.primaryGoal}`,
    workspace.currencyCode && `Currency: ${workspace.currencyCode}`,
    workspace.timezone && `Timezone: ${workspace.timezone}`,
    workspace.dailyBudgetCeiling && `Approved daily budget ceiling: ${workspace.dailyBudgetCeiling}`,
  ].filter(Boolean)

  const formattedContext = details.length ? `\nThis business has confirmed the following context. Use it when relevant and never invent facts beyond it:\n${details.join("\n")}` : ""

  // Cache the result
  contextCache[workspaceId] = { data: formattedContext, timestamp: Date.now() };

  return formattedContext;
}

/**
 * Validate if a URL is safe to fetch (basic SSRF protection)
 * @param url - The URL to validate
 * @returns True if URL appears safe
 */
function isSafeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (!urlObj.protocol.startsWith('http')) {
      return false;
    }

    // Get hostname
    const hostname = urlObj.hostname.toLowerCase();

    // Block localhost and loopback addresses
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.') ||
        hostname.endsWith('.local')) {
      return false;
    }

    // Additional common internal domains to block
    const blockedDomains = [
      'internal',
      'intranet',
      'corp',
      'private',
      'local'
    ];

    if (blockedDomains.some(domain => hostname.includes(`.${domain}`) || hostname === domain)) {
      return false;
    }

    return true;
  } catch {
    // If URL parsing fails, consider it unsafe
    return false;
  }
}

/**
 * Fetch and summarize website content
 * @param url - The website URL to scrape
 * @returns Summary of website content or null if failed
 */
async function summarizeWebsite(url: string): Promise<string | null> {
  try {
    // Validate URL for security (SSRF protection)
    if (!isSafeUrl(url)) {
      throw new Error(`URL not allowed for security reasons: ${url}`);
    }

    // Validate URL format
    const urlObj = new URL(url);

    // Fetch the webpage with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GrowzzyOS/1.0; +https://growzzyos.com/bot)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content type to avoid processing binary data
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = await response.text();

    // Limit response size to prevent DoS
    if (html.length > 1024 * 1024) { // 1MB limit
      throw new Error('Response too large');
    }

    // Extract text content from HTML (simple approach)
    const text = extractTextFromHtml(html);

    // Summarize the text (simple approach: take first few sentences/paragraphs)
    const summary = summarizeText(text);

    return summary;
  } catch (error) {
    console.warn(`Error summarizing website ${url}:`, error);
    return null;
  }
}

/**
 * Extract visible text from HTML using simple regex
 * @param html - Raw HTML string
 * @returns Extracted text content
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style elements
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*> /g, ' ') // Replace HTML tags with space
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();

  return text;
}

/**
 * Simple text summarization - extract first few meaningful sentences
 * @param text - Text to summarize
 * @returns Summary string
 */
function summarizeText(text: string): string {
  if (!text) return '';

  // Split into sentences (simple approach)
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [];

  // Take first 3-5 sentences that have reasonable length
  const meaningfulSentences = sentences
    .filter(s => s.trim().length > 20) // Filter out very short sentences
    .slice(0, 5); // Take first 5 meaningful sentences

  // Join and limit length
  let summary = meaningfulSentences.join(' ').trim();

  // Limit to reasonable length (around 500 chars)
  if (summary.length > 500) {
    summary = summary.substring(0, 500).trim() + '...';
  }

  return summary || text.substring(0, Math.min(500, text.length));
}

/**
 * Invalidate business context cache for a workspace
 * Should be called when workspace data (especially website) is updated
 * @param workspaceId - The workspace ID
 */
export function invalidateBusinessContext(workspaceId: string): void {
  delete contextCache[workspaceId];
  // Also clear any parent caches if needed
  // For example, if we have hierarchical workspaces
}

/**
 * Manually refresh business context (convenience function)
 * @param workspaceId - The workspace ID
 * @returns Fresh business context string
 */
export async function refreshBusinessContext(workspaceId: string): Promise<string> {
  invalidateBusinessContext(workspaceId);
  return await getBusinessContextForWorkspace(workspaceId);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getBusinessContextForWorkspace instead
 */
export function formatBusinessContext(workspace: {
  name?: string | null
  websiteUrl?: string | null
  primaryGoal?: string | null
  currencyCode?: string | null
  timezone?: string | null
  productDescription?: string | null
  industry?: string | null
  toneOfVoice?: string | null
  dailyBudgetCeiling?: number | null
} | null): string {
  if (!workspace) return ""
  const details = [
    workspace.name && `Business: ${workspace.name}`,
    workspace.productDescription && `Confirmed business summary: ${workspace.productDescription}`,
    workspace.websiteUrl && `Website: ${workspace.websiteUrl}`,
    workspace.industry && `Industry: ${workspace.industry}`,
    workspace.toneOfVoice && `Preferred voice: ${workspace.toneOfVoice}`,
    workspace.primaryGoal && `Primary goal: ${workspace.primaryGoal}`,
    workspace.currencyCode && `Currency: ${workspace.currencyCode}`,
    workspace.timezone && `Timezone: ${workspace.timezone}`,
    workspace.dailyBudgetCeiling && `Approved daily budget ceiling: ${workspace.dailyBudgetCeiling}`,
  ].filter(Boolean)
  return details.length ? `\nThis business has confirmed the following context. Use it when relevant and never invent facts beyond it:\n${details.join("\n")}` : ""
}
