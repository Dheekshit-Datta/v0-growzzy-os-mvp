"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { brandIsReady, loadBrand } from "@/lib/brand-store"
import {
  ChevronDown,
  Mic,
  Plus,
  Send,
  Sparkles,
  Square,
  User,
} from "lucide-react"
import { toast } from "sonner"

const MODES = [
  { value: "auto", label: "Auto", icon: Sparkles },
  { value: "deep", label: "Deep research", icon: Sparkles },
]

export function AgentComposer({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  mode,
  onModeChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop?: () => void
  loading: boolean
  mode: string
  onModeChange: (mode: string) => void
  placeholder?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [modeOpen, setModeOpen] = useState(false)
  const brandReady = typeof window !== "undefined" && brandIsReady(loadBrand())

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !loading) onSend()
    }
  }

  const currentMode = MODES.find((m) => m.value === mode) || MODES[0]

  return (
    <div className="w-full">
      <div className="rounded-[18px] border border-border bg-card shadow-xs overflow-hidden focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/40 transition-all">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask anything, or describe what to launch…"}
          className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed px-4 pt-3.5 pb-1 min-h-[40px]"
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-2.5 py-2 border-t border-border">
          {/* Left controls */}
          <div className="flex items-center gap-1.5">
            {/* Attach */}
            <button
              type="button"
              onClick={() => toast.info("Attachments are coming soon.")}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Attach file"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Mode selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModeOpen(!modeOpen)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {currentMode.label}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>

              {modeOpen && (
                <div className="absolute bottom-full mb-1 left-0 w-44 bg-card border border-border rounded-[12px] shadow-lg py-1.5 z-20">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        onModeChange(m.value)
                        setModeOpen(false)
                      }}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted flex items-center justify-between cursor-pointer",
                        mode === m.value
                          ? "font-bold text-primary bg-primary-tint/50"
                          : "text-foreground"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Brand indicator */}
            <button
              type="button"
              onClick={() => toast.info(brandReady ? "Brand context is loaded and active." : "No brand context — set it up in My Brand.")}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-colors cursor-pointer",
                brandReady
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={brandReady ? "Brand context active" : "No brand context"}
            >
              <User className="h-4 w-4" />
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {/* Voice (placeholder) */}
            <button
              type="button"
              onClick={() => toast.info("Voice input is coming soon.")}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Voice input"
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Send / Stop */}
            {loading ? (
              <button
                type="button"
                onClick={onStop}
                className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors cursor-pointer"
                title="Stop"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!value.trim()}
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                  value.trim()
                    ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-xs"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                title="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
