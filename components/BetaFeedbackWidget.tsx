"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { MessageSquare, Star, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function BetaFeedbackWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setHidden(localStorage.getItem("growzzy-feedback-submitted") === "true")
  }, [])

  useEffect(() => {
    const openFeedback = () => {
      setHidden(false)
      setOpen(true)
    }
    window.addEventListener("growzzy:open-feedback", openFeedback)
    return () => window.removeEventListener("growzzy:open-feedback", openFeedback)
  }, [])

  const submit = async () => {
    if (message.trim().length < 3) {
      toast.error("Drop a little feedback first")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          message,
          email,
          page: pathname,
          userAgent: navigator.userAgent,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Feedback failed")
      toast.success("Thank you! Your feedback helps us improve.")
      localStorage.setItem("growzzy-feedback-submitted", "true")
      setHidden(true)
      setMessage("")
      setEmail("")
      setOpen(false)
    } catch (error: any) {
      toast.error(error.message || "Could not send feedback")
    } finally {
      setSubmitting(false)
    }
  }

  if (hidden) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 font-satoshi">
      {open && (
        <div className="mb-3 w-[320px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950">Beta feedback</p>
              <p className="text-xs text-slate-500">Tiny notes here save big chaos later.</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)} className="p-0.5">
                <Star className={cn("h-5 w-5", star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            placeholder="What's broken, confusing, or secretly awesome?"
            className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#1F57F5]"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email (optional)"
            className="mt-2 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#1F57F5]"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-3 h-9 w-full rounded-xl bg-[#111] text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send feedback"}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full bg-[#111] px-4 py-2 text-xs font-bold text-white shadow-xl"
      >
        <MessageSquare className="h-4 w-4" />
        Give Feedback
      </button>
    </div>
  )
}
