'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'

interface ExecutionLog {
  id: string
  automation_id: string
  automation_name: string
  status: 'success' | 'failed'
  message: string
  result?: any
  executed_at: string
}

export function AutomationLogs() {
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchLogs()
    
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 10000) // Refresh every 10s
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/automations/logs')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('[v0] Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'success') {
      return <CheckCircle className="w-5 h-5 text-green-600" />
    }
    return <AlertCircle className="w-5 h-5 text-red-600" />
  }

  const formatTime = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Execution History</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs()}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-spin" />
          <p className="text-muted-foreground">Loading execution history...</p>
        </Card>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">No execution logs yet</p>
        </Card>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <Card key={log.id} className="p-4 hover:bg-muted/50 transition">
              <div className="flex items-start gap-3">
                {getStatusIcon(log.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium">{log.automation_name}</h4>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(log.executed_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{log.message}</p>
                  {log.result && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-primary">
                        View details
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(log.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    log.status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {log.status === 'success' ? 'Success' : 'Failed'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
