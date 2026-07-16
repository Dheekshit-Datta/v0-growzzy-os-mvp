"use client"

import { Shell } from "@/components/shell"
import { FolderOpen, Plus, MoreHorizontal } from "lucide-react"
import Link from "next/link"

export default function ProjectsPage() {
  return (
    <Shell title="Projects">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[13px] text-[#6B7280]">Organise your campaigns into folders.</p>
          <button className="flex items-center gap-1.5 h-8 px-4 bg-[#1F57F5] text-white text-[12.5px] font-semibold rounded-[8px] hover:bg-[#1849d6] transition-colors">
            <Plus size={13} />
            New Project
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-4">
            <FolderOpen size={20} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[14px] font-semibold text-[#374151]">No projects yet</p>
          <p className="text-[12.5px] text-[#9CA3AF] mt-1 mb-5 max-w-[280px]">
            Create a project to keep your campaigns organised by client or goal.
          </p>
          <button className="flex items-center gap-1.5 h-8 px-4 bg-[#1F57F5] text-white text-[12.5px] font-semibold rounded-[8px] hover:bg-[#1849d6] transition-colors">
            <Plus size={13} />
            Create first project
          </button>
        </div>
      </div>
    </Shell>
  )
}
