"use client"

import { useState } from "react"
import { Shell } from "@/components/shell"
import { Zap, Bell, CheckSquare, Cpu } from "lucide-react"
import { cn } from "@/lib/utils"

type OTab = "recommendations" | "log" | "autopilot"

export default function OptimizationPage() {
  const [activeTab, setActiveTab] = useState<OTab>("recommendations")

  return (
    <Shell title="AI Optimization">
      <div className="p-6 space-y-5">
        {/* Tabs */}
        <div className="bg-white rounded-[14px] border border-[#E9EBEF] overflow-hidden">
          <div className="border-b border-[#E9EBEF] px-5">
            <div className="flex gap-1">
              {[
                { id: "recommendations" as OTab, label: "Recommendations" },
                { id: "log" as OTab, label: "Action Log" },
                { id: "autopilot" as OTab, label: "Autopilot" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "h-11 px-4 text-[13px] font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-[#1F57F5] text-[#1F57F5]"
                      : "border-transparent text-[#6B7280] hover:text-[#374151]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {activeTab === "recommendations" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-4">
                  <Zap size={20} className="text-[#D1D5DB]" />
                </div>
                <p className="text-[14px] font-semibold text-[#374151]">No recommendations yet</p>
                <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[300px]">
                  Once your campaigns are live, AI will flag issues and opportunities here with plain-English suggestions.
                </p>
              </div>
            )}

            {activeTab === "log" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-4">
                  <CheckSquare size={20} className="text-[#D1D5DB]" />
                </div>
                <p className="text-[14px] font-semibold text-[#374151]">No actions taken yet</p>
                <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[300px]">
                  Every AI-applied change will appear here with a full timeline and outcome.
                </p>
              </div>
            )}

            {activeTab === "autopilot" && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    id: "alert",
                    title: "Alert only",
                    description: "AI spots issues and tells you about them. You decide what to do.",
                    bullets: ["Sends email alerts for critical issues", "Never changes anything automatically", "Full control stays with you"],
                    default: true,
                  },
                  {
                    id: "approval",
                    title: "Approval required",
                    description: "AI drafts a fix and waits for your click before applying it.",
                    bullets: ["Suggestions appear in Recommendations", "One click to apply or dismiss", "Nothing runs without your OK"],
                    default: false,
                  },
                  {
                    id: "full",
                    title: "Full autopilot",
                    description: "AI applies optimisations automatically within your guardrails.",
                    bullets: ["Applies bid and budget tweaks automatically", "Every action logged with an Undo button", "Guardrails prevent runaway spend"],
                    default: false,
                  },
                ].map((mode, i) => (
                  <div
                    key={mode.id}
                    className={cn(
                      "rounded-[12px] border p-5 cursor-pointer transition-all",
                      mode.default
                        ? "border-[#1F57F5] bg-[#EAF0FE]"
                        : "border-[#E9EBEF] bg-white hover:border-[#D1D5DB]"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        mode.default ? "bg-[#1F57F5]" : "bg-[#F6F7F9]"
                      )}>
                        {i === 0 && <Bell size={14} className={mode.default ? "text-white" : "text-[#9CA3AF]"} />}
                        {i === 1 && <CheckSquare size={14} className={mode.default ? "text-white" : "text-[#9CA3AF]"} />}
                        {i === 2 && <Cpu size={14} className={mode.default ? "text-white" : "text-[#9CA3AF]"} />}
                      </div>
                      {mode.default && (
                        <span className="text-[10px] font-semibold text-[#1F57F5] bg-white px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[13.5px] font-semibold text-[#111827] mb-1">{mode.title}</p>
                    <p className="text-[12px] text-[#6B7280] mb-3 leading-relaxed">{mode.description}</p>
                    <ul className="space-y-1.5">
                      {mode.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-1.5 text-[11.5px] text-[#6B7280]">
                          <span className="w-1 h-1 rounded-full bg-[#9CA3AF] mt-1.5 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
