"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  status: "new" | "contacted" | "qualified" | "converted"
  source: string
}

const STATUS_COLORS = {
  new: "bg-blue-100",
  contacted: "bg-yellow-100",
  qualified: "bg-green-100",
  converted: "bg-purple-100",
}

export function LeadsKanban() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "" })

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const response = await fetch("/api/leads/list")
      if (response.ok) {
        const data = await response.json()
        setLeads(data.leads || [])
      }
    } catch (error) {
      console.error("[v0] Failed to fetch leads:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLead = async () => {
    if (!newLead.name || !newLead.email) return

    try {
      const response = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      })

      if (response.ok) {
        const data = await response.json()
        setLeads([data.lead, ...leads])
        setNewLead({ name: "", email: "", phone: "" })
      }
    } catch (error) {
      console.error("[v0] Failed to add lead:", error)
    }
  }

  const statuses: ("new" | "contacted" | "qualified" | "converted")[] = ["new", "contacted", "qualified", "converted"]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add New Lead</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Name"
            value={newLead.name}
            onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
          />
          <Input
            placeholder="Email"
            value={newLead.email}
            onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
          />
          <Input
            placeholder="Phone"
            value={newLead.phone}
            onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
          />
          <Button onClick={handleAddLead} className="w-full">
            Add Lead
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8">Loading leads...</div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {statuses.map((status) => (
            <div key={status} className="space-y-4">
              <h3 className="font-semibold capitalize">{status}</h3>
              {leads
                .filter((lead) => lead.status === status)
                .map((lead) => (
                  <Card key={lead.id} className={STATUS_COLORS[status]}>
                    <CardContent className="pt-4">
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-gray-600">{lead.email}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
