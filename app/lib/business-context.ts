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
  // In a real implementation, this would:
  // 1. Get workspace details from database
  // 2. If website URL exists, scrape it for business information
  // 3. Combine with explicitly provided business description
  // 4. Return formatted context string

  // Placeholder implementation - replace with actual logic
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      websiteUrl: true,
      businessDescription: true,
      // Add other relevant fields as needed
      industry: true,
      toneOfVoice: true,
    }
  });

  let context = "";

  if (workspace?.businessDescription) {
    context += `Business Description: ${workspace.businessDescription}\n`;
  }

  if (workspace?.websiteUrl) {
    // TODO: Implement actual website scraping and summarization
    // For now, we'll just include the URL
    context += `Website URL: ${workspace.websiteUrl}\n`;

    // In production, replace the above with something like:
    // const websiteContent = await scrapeWebsite(workspace.websiteUrl);
    // const summary = await summarizeWebsiteContent(websiteContent);
    // context += `Website Summary: ${summary}\n`;
  }

  if (workspace?.industry) {
    context += `Industry: ${workspace.industry}\n`;
  }

  if (workspace?.toneOfVoice) {
    context += `Tone of Voice: ${workspace.toneOfVoice}\n`;
  }

  // Cache the result
  contextCache[workspaceId] = { data: context, timestamp: Date.now() };

  return context;
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