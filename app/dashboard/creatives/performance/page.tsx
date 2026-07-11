"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  DollarSign,
  RefreshCw,
  Download,
  Filter
} from "lucide-react"

export const dynamic = "force-dynamic"

export default function CreativesPerformancePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [creatives, setCreatives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("7d")
  const [sortBy, setSortBy] = useState("performance")

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me")
        if (!response.ok) {
          router.push("/auth")
          return
        }
        const data = await response.json()
        setUser(data.user)
      } catch (error) {
        console.error("[v0] Auth error:", error)
        router.push("/auth")
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (user) {
      fetchCreatives()
    }
  }, [user, timeRange])

  const fetchCreatives = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/creatives/performance?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setCreatives(data.creatives || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching creative performance:", error)
    } finally {
      setLoading(false)
    }
  }

  const sortedCreatives = [...creatives].sort((a, b) => {
    switch (sortBy) {
      case "performance":
        return (b.performance?.ctr || 0) - (a.performance?.ctr || 0)
      case "impressions":
        return (b.performance?.impressions || 0) - (a.performance?.impressions || 0)
      case "conversions":
        return (b.performance?.conversions || 0) - (a.performance?.conversions || 0)
      case "spend":
        return (b.performance?.spend || 0) - (a.performance?.spend || 0)
      default:
        return 0
    }
  })

  if (!user) return null

  return (
    <DashboardLayout>
      <div className="p-8 bg-white min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Creative Performance</h1>
              <p className="text-gray-600 mt-2">Analyze the performance of your ad creatives across platforms</p>
            </div>
            <div className="flex gap-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="performance">Best Performing</SelectItem>
                  <SelectItem value="impressions">Most Impressions</SelectItem>
                  <SelectItem value="conversions">Most Conversions</SelectItem>
                  <SelectItem value="spend">Highest Spend</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Creatives</h3>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{creatives.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Avg CTR</h3>
                <Eye className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {(creatives.reduce((sum, c) => sum + (c.performance?.ctr || 0), 0) / creatives.length || 0).toFixed(2)}%
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Conversions</h3>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {creatives.reduce((sum, c) => sum + (c.performance?.conversions || 0), 0)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Spend</h3>
                <DollarSign className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ${creatives.reduce((sum, c) => sum + (c.performance?.spend || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {sortedCreatives.length === 0 ? (
                <div className="text-center py-16">
                  <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No performance data</h3>
                  <p className="text-gray-600 mb-6">Start running campaigns to see creative performance analytics</p>
                  <Button>Create Campaign</Button>
                </div>
              ) : (
                sortedCreatives.map((creative) => (
                  <div key={creative.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{creative.name}</h3>
                        <Badge variant="outline">{creative.platform}</Badge>
                        <Badge variant={creative.status === "active" ? "default" : "secondary"}>
                          {creative.status}
                        </Badge>
                        {creative.performance?.trend === "up" ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        Created {new Date(creative.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Impressions</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {creative.performance?.impressions?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Clicks</p>
                        <p className="text-lg font-semibold text-blue-600">
                          {creative.performance?.clicks?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">CTR</p>
                        <p className="text-lg font-semibold text-green-600">
                          {creative.performance?.ctr || "0.0%"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Conversions</p>
                        <p className="text-lg font-semibold text-purple-600">
                          {creative.performance?.conversions || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Spend</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${creative.performance?.spend || "0.00"}
                        </p>
                      </div>
                    </div>

                    {creative.imageUrl && (
                      <div className="mt-4">
                        <img 
                          src={creative.imageUrl} 
                          alt={creative.name}
                          className="h-20 w-20 object-cover rounded border border-gray-200"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
