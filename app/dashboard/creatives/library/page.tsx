"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Palette,
  Search,
  Filter,
  Eye,
  Download,
  Edit,
  Trash2,
  Plus,
  Grid,
  List
} from "lucide-react"

export const dynamic = "force-dynamic"

export default function CreativesLibraryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [creatives, setCreatives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

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
  }, [user])

  const fetchCreatives = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/creatives")
      if (response.ok) {
        const data = await response.json()
        setCreatives(data.creatives || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching creatives:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCreatives = (Array.isArray(creatives) ? creatives : []).filter(creative => {
    const s = (searchTerm || "").toLowerCase()
    const matchesSearch = !s ||
      (creative?.name || "").toLowerCase().includes(s) ||
      (creative?.headline || "").toLowerCase().includes(s)
    const matchesPlatform = filterPlatform === "all" || creative?.platform === filterPlatform
    return matchesSearch && matchesPlatform
  })

  if (!user) return null

  return (
    <DashboardLayout>
      <div className="p-8 bg-white min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Creative Library</h1>
              <p className="text-gray-600 mt-2">Browse and manage your ad creatives and templates</p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Creative
            </Button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search creatives..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <>
              {filteredCreatives.length === 0 ? (
                <div className="text-center py-16">
                  <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No creatives found</h3>
                  <p className="text-gray-600 mb-6">Create your first ad creative to get started</p>
                  <Button>Create Creative</Button>
                </div>
              ) : (
                <>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredCreatives.map((creative) => (
                        <div key={creative.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                          {creative.imageUrl && (
                            <div className="aspect-video bg-gray-100">
                              <img 
                                src={creative.imageUrl} 
                                alt={creative.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold text-gray-900 truncate">{creative.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {creative.platform}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{creative.headline}</p>
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-gray-500">
                                {creative.performance?.impressions || 0} impressions
                              </div>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Download className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredCreatives.map((creative) => (
                        <div key={creative.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">{creative.name}</h3>
                                <Badge variant="outline">{creative.platform}</Badge>
                                <Badge variant={creative.status === "active" ? "default" : "secondary"}>
                                  {creative.status}
                                </Badge>
                              </div>
                              <p className="text-gray-700 mb-3">{creative.headline}</p>
                              <p className="text-sm text-gray-600 mb-4">{creative.description}</p>
                              
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-600">Impressions</p>
                                  <p className="font-semibold">{creative.performance?.impressions || 0}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Clicks</p>
                                  <p className="font-semibold">{creative.performance?.clicks || 0}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">CTR</p>
                                  <p className="font-semibold">{creative.performance?.ctr || "0.0%"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Conversions</p>
                                  <p className="font-semibold">{creative.performance?.conversions || 0}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 ml-4">
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
