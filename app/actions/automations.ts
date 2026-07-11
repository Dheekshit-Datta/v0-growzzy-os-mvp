"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const AutomationSchema = z.object({
    name: z.string().min(1, "Name required"),
    triggerType: z.string().default("ROAS_DROP"),
    actionType: z.string().default("NOTIFY_SLACK"),
    description: z.string().optional()
})

export async function getAutomations() {
    const session = await auth()
    if (!session?.user?.id) return []

    try {
        const dbAutos = await prisma.automation.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" }
        })
        return JSON.parse(JSON.stringify(dbAutos))
    } catch (e) {
        console.error("Get Automations Error", e)
        return []
    }
}

export async function deployAutomation(data: any) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        const validated = AutomationSchema.parse({
            name: data.name,
            triggerType: data.trigger,
            actionType: data.action
        })

        const automation = await prisma.automation.create({
            data: {
                userId: session.user.id,
                name: validated.name,
                triggerType: validated.triggerType,
                actionType: validated.actionType,
                trigger: { type: validated.triggerType }, // Store simplified logic
                action: { type: validated.actionType },
                status: "active",
                runCount: 0
            }
        })
        revalidatePath("/dashboard/automations")
        return { success: true, automation: JSON.parse(JSON.stringify(automation)) }

    } catch (e: any) {
        return { error: e.message || "Deployment Failed" }
    }
}

export async function testAutomation(id: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const automation = await prisma.automation.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true, name: true, triggerType: true, actionType: true, status: true },
    })
    if (!automation) return { error: "Automation not found" }

    return {
        success: true,
        impact: `Rule is configured as ${automation.triggerType} -> ${automation.actionType}. Live execution is disabled until Google optimization apply/undo is wired.`,
    }
}

export async function toggleAutomation(id: string, currentState: boolean) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        // currentState passed from frontend might be based on old boolean logic or new string logic
        // But the function signature says boolean. 
        // Let's ignore currentState arg and just flip based on DB or pass the target status string.
        // Actually, to be safe, I'll fetch the current one or just trust the intent.
        // The frontend sends `!isActive` (boolean). 
        // If frontend sends `true` (meaning "make active"), I set "active".
        // If `false` (meaning "make paused"), I set "paused".

        const targetStatus = currentState ? "active" : "paused"

        await prisma.automation.update({
            where: { id, userId: session.user.id },
            data: { status: targetStatus }
        })
        revalidatePath("/dashboard/automations")
        return { success: true }
    } catch (e) {
        return { error: "Toggle failed" }
    }
}

export async function deleteAutomation(id: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        await prisma.automation.delete({
            where: { id, userId: session.user.id }
        })
        revalidatePath("/dashboard/automations")
        return { success: true }
    } catch {
        return { error: "Delete failed" }
    }
}
