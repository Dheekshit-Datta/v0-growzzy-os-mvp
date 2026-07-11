"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Trash2 } from "lucide-react"

interface Campaign {
  id: string
  name: string
  platform: string
  status: string
  budget: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
}

export function CampaignsTable() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns/list")
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error("[v0] Failed to fetch campaigns:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign?")) return
    try {
      const response = await fetch(`/api/campaigns/${id}`, { method: "DELETE" })
      if (response.ok) {
        setCampaigns(campaigns.filter((c) => c.id !== id))
      }
    } catch (error) {
      console.error("[v0] Failed to delete campaign:", error)
    }
  }

  const filtered = campaigns.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns</CardTitle>
        <Input
          placeholder="Filter campaigns..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mt-4"
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading campaigns...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Name</th>
                  <th className="text-left py-2 px-4">Platform</th>
                  <th className="text-left py-2 px-4">Budget</th>
                  <th className="text-left py-2 px-4">Impressions</th>
                  <th className="text-left py-2 px-4">Clicks</th>
                  <th className="text-left py-2 px-4">CTR</th>
                  <th className="text-right py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((campaign) => (
                  <tr key={campaign.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{campaign.name}</td>
                    <td className="py-2 px-4 capitalize">{campaign.platform}</td>
                    <td className="py-2 px-4">${campaign.budget || 0}</td>
                    <td className="py-2 px-4">{campaign.impressions || 0}</td>
                    <td className="py-2 px-4">{campaign.clicks || 0}</td>
                    <td className="py-2 px-4">{(campaign.ctr || 0).toFixed(2)}%</td>
                    <td className="py-2 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(campaign.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
