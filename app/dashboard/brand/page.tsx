"use client"

import { Shell } from "@/components/shell"
import { Upload, Check, ChevronDown } from "lucide-react"

function FormField({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-[#374151]">{label}</label>
      {children}
      {helper && <p className="text-[11.5px] text-[#9CA3AF]">{helper}</p>}
    </div>
  )
}

export default function BrandPage() {
  return (
    <Shell title="My Brand">
      <div className="p-6 max-w-[720px]">
        {/* Helper banner */}
        <div className="bg-[#EAF0FE] rounded-[10px] px-4 py-3 mb-5 text-[12.5px] text-[#1F57F5] font-medium">
          Every campaign Growzzy writes uses this information. Keep it accurate and detailed for the best results.
        </div>

        <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-6 space-y-5">
          {/* Logo upload */}
          <FormField label="Brand logo">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-[#F6F7F9] rounded-[10px] border-2 border-dashed border-[#E9EBEF] flex items-center justify-center">
                <Upload size={18} className="text-[#D1D5DB]" />
              </div>
              <div>
                <button className="flex items-center gap-1.5 h-8 px-3 bg-white border border-[#E9EBEF] rounded-[8px] text-[12.5px] font-medium text-[#374151] hover:border-[#D1D5DB] transition-colors">
                  <Upload size={13} />
                  Upload logo
                </button>
                <p className="text-[11px] text-[#9CA3AF] mt-1">PNG, JPG or SVG · Max 2MB</p>
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Business name">
              <input
                placeholder="Your business name"
                className="w-full h-9 px-3 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors"
              />
            </FormField>
            <FormField label="Website">
              <input
                type="url"
                placeholder="https://yoursite.com"
                className="w-full h-9 px-3 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors"
              />
            </FormField>
            <FormField label="Industry">
              <div className="relative">
                <select className="w-full h-9 pl-3 pr-8 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors appearance-none">
                  <option>Select industry</option>
                  <option>E-commerce / Retail</option>
                  <option>Real Estate</option>
                  <option>Healthcare</option>
                  <option>Finance</option>
                  <option>Education</option>
                  <option>Technology / SaaS</option>
                  <option>Fashion & Apparel</option>
                  <option>Food & Beverage</option>
                  <option>Travel & Hospitality</option>
                  <option>Other</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Tone of voice">
              <div className="relative">
                <select className="w-full h-9 pl-3 pr-8 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors appearance-none">
                  <option>Professional</option>
                  <option>Friendly & casual</option>
                  <option>Luxury & premium</option>
                  <option>Bold & direct</option>
                  <option>Empathetic</option>
                  <option>Playful</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              </div>
            </FormField>
            <div className="col-span-2">
              <FormField
                label="Product / service description"
                helper="What do you sell, who buys it, and what makes you different? The AI uses this for every campaign."
              >
                <textarea
                  rows={5}
                  placeholder="Describe your product or service in detail..."
                  className="w-full px-3 py-2.5 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors resize-none leading-relaxed"
                />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Default landing page URL" helper="Optional — the AI will suggest this as a destination when building campaigns.">
                <input
                  type="url"
                  placeholder="https://yoursite.com/landing-page"
                  className="w-full h-9 px-3 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors"
                />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#E9EBEF]">
            <button className="flex items-center gap-1.5 h-9 px-5 bg-[#1F57F5] text-white text-[13px] font-semibold rounded-[8px] hover:bg-[#1849d6] transition-colors">
              <Check size={14} />
              Save brand kit
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}
