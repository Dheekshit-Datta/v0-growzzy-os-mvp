"use client"

import { Shell } from "@/components/dashboard-v2/shell"
import { FolderOpen } from "lucide-react"

export default function ProjectsPage() {
  return (
    <Shell title="Projects">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[13px] text-[#6B7280]">Organise your campaigns into folders.</p>
          <span className="text-[9.5px] font-bold text-[#6B7280] bg-[#E0E2E6] px-2 py-1 rounded-full uppercase tracking-wide">Coming soon</span>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-4">
            <FolderOpen size={20} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[14px] font-semibold text-[#374151]">Projects aren't built yet</p>
          <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[280px]">
            Organizing campaigns into folders by client or goal is planned but not built. Your campaigns are all visible in Ads Manager today.
          </p>
        </div>
      </div>
    </Shell>
  )
}
