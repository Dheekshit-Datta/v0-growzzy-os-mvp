"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OpenAIService } from "@/lib/openai-service"
import { resolveUserId } from "@/lib/resolve-user"
import { calculateLeadScore } from "@/lib/lead-scoring"
import { getPrimaryWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope, requireActiveAdAccountScope } from "@/lib/account-scope"

const LeadSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    company: z.string().optional(),
    phone: z.string().optional(),
    position: z.string().optional(),
    estimatedValue: z.number().optional().default(0),
    source: z.string().optional().default("Manual"),
    status: z.string().optional().default("new")
})

export type LeadState = {
    message?: string
    error?: string
    success?: boolean
    lead?: any
}

export async function createLead(data: any): Promise<LeadState> {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return { error: "Unauthorized" }
        }
        const userId = await resolveUserId(session.user.id)
        const workspaceId = await getPrimaryWorkspaceId(userId)
        const scope = await requireActiveAdAccountScope(userId, workspaceId)

        const validated = LeadSchema.parse(data)

        // ── REAL Lead Scoring (NO randomness) ──────────────────
        const scoreResult = calculateLeadScore({
            email: validated.email,
            phone: validated.phone,
            company: validated.company,
            position: validated.position,
            source: validated.source,
            estimatedValue: validated.estimatedValue,
        })

        // Optionally enrich with AI scoring if OpenAI is available
        let aiInsights = scoreResult.reasoning
        try {
            if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'placeholder') {
                const aiScore = await OpenAIService.scoreLead({
                    company: validated.company,
                    email: validated.email,
                    source: validated.source,
                    value: validated.estimatedValue,
                }, userId)
                if (aiScore?.reasoning) {
                    aiInsights = `${scoreResult.reasoning} | AI: ${aiScore.reasoning}`
                }
            }
        } catch (e) { console.warn("[createLead] AI Scoring Failed", e) }

        const lead = await prisma.lead.create({
            data: {
                name: validated.name,
                email: validated.email,
                company: validated.company,
                phone: validated.phone,
                position: validated.position,
                estimatedValue: validated.estimatedValue,
                source: validated.source,
                status: validated.status,
                userId: userId,
                workspaceId,
                adAccountId: scope.adAccountId,
                aiScore: scoreResult.score,
                aiInsights: aiInsights,
            }
        })

        revalidatePath("/dashboard/leads")
        return { success: true, lead: JSON.parse(JSON.stringify(lead)) }
    } catch (err: any) {
        console.error("Create Lead Error:", err)

        if (err.message?.includes("SASL") || err.message?.includes("connection")) {
            return { error: "Database connection failed. Please check your credentials." }
        }
        return { error: err.message || "Failed to create lead" }
    }
}

export async function getLeads() {
    const session = await auth()
    if (!session?.user?.id) return []
    try {
        const userId = await resolveUserId(session.user.id)
        const workspaceId = await getPrimaryWorkspaceId(userId)
        const scope = await requireActiveAdAccountScope(userId, workspaceId)
        const leads = await prisma.lead.findMany({
            where: { userId, workspaceId, adAccountId: scope.adAccountId },
            orderBy: { createdAt: "desc" }
        })
        return JSON.parse(JSON.stringify(leads))
    } catch (e: any) {
        console.error("getLeads error:", e.message)
        return []
    }
}

// Bulk import with REAL scoring for each lead
export async function importLeadsBulk(leads: any[]): Promise<LeadState> {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const userId = await resolveUserId(session.user.id)
    try {
        const workspaceId = await getPrimaryWorkspaceId(userId)
        const scope = await getActiveAdAccountScope(userId, workspaceId)
        if (!scope) return { error: "Connect and select an ad account before importing leads." }

        const validLeads = leads.map(l => {
            const email = String(l.email || l.Email || "")
            const company = l.company || l.Company ? String(l.company || l.Company) : undefined
            const phone = l.phone || l.Phone ? String(l.phone || l.Phone) : undefined
            const position = l.position || l.Position ? String(l.position || l.Position) : undefined
            const source = String(l.source || l.Source || "Import")
            const value = l.value || l.Value ? parseFloat(String(l.value || l.Value).replace(/[^0-9.]/g, '')) : 0

            // Calculate score for each lead deterministically
            const scoreResult = calculateLeadScore({
                email,
                phone,
                company,
                position,
                source,
                estimatedValue: value,
            })

            return {
                userId: userId,
                workspaceId,
                adAccountId: scope.adAccountId,
                email,
                name: String(l.name || l.Name || (email ? email.split('@')[0] : "Unknown")),
                company,
                phone,
                position,
                estimatedValue: value,
                source,
                status: "new",
                aiScore: scoreResult.score,
                aiInsights: scoreResult.reasoning,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }).filter(l => l.email && l.email.includes('@'))

        if (validLeads.length === 0) return { error: "No valid rows found (Email required)" }

        const result = await prisma.lead.createMany({
            data: validLeads as any,
            skipDuplicates: true
        })

        revalidatePath("/dashboard/leads")
        return { success: true, message: `Successfully imported ${result.count} leads` }
    } catch (e: any) {
        console.error("Bulk Import Error:", e)
        return { error: "Database error during import" }
    }
}

export async function importLeads(csvData: string): Promise<LeadState> {
    return importLeadsBulk([])
}
