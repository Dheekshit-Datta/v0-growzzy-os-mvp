'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface AutomationBuilderProps {
  onSave: (automation: any) => void
  onCancel: () => void
  initialData?: any
}

export function AutomationBuilder({ onSave, onCancel, initialData }: AutomationBuilderProps) {
  const [step, setStep] = useState<'trigger' | 'action' | 'review'>('trigger')
  const [formData, setFormData] = useState(initialData || {
    name: '',
    description: '',
    trigger_type: '',
    trigger_config: {},
    action_type: '',
    action_config: {},
    is_active: true,
  })

  const handleTriggerTypeChange = (type: string) => {
    setFormData({
      ...formData,
      trigger_type: type,
      trigger_config: {},
    })
  }

  const handleActionTypeChange = (type: string) => {
    setFormData({
      ...formData,
      action_type: type,
      action_config: {},
    })
  }

  const handleSave = async () => {
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Create Automation</h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="flex gap-4 mb-8">
          {(['trigger', 'action', 'review'] as const).map((s) => (
            <div
              key={s}
              className={`flex items-center gap-2 pb-2 border-b-2 cursor-pointer transition ${
                step === s ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
              }`}
              onClick={() => setStep(s)}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {['trigger', 'action', 'review'].indexOf(s) + 1}
              </div>
              <span className="capitalize text-sm">{s}</span>
            </div>
          ))}
        </div>

        {/* Trigger Step */}
        {step === 'trigger' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                placeholder="e.g., Pause low ROAS campaigns"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                placeholder="What does this automation do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-background h-20 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Trigger Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'time_based', label: 'Time-Based', desc: 'Run on schedule' },
                  { id: 'roas_threshold', label: 'ROAS Threshold', desc: 'When ROAS changes' },
                  { id: 'spend_threshold', label: 'Spend Threshold', desc: 'When spend reaches limit' },
                  { id: 'lead_received', label: 'Lead Received', desc: 'When new lead arrives' },
                ].map((trigger) => (
                  <button
                    key={trigger.id}
                    onClick={() => handleTriggerTypeChange(trigger.id)}
                    className={`p-3 rounded border-2 text-left transition ${
                      formData.trigger_type === trigger.id
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{trigger.label}</div>
                    <div className="text-xs text-muted-foreground">{trigger.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Config */}
            {formData.trigger_type === 'time_based' && (
              <div className="space-y-3 bg-muted/50 p-4 rounded">
                <div>
                  <label className="block text-sm font-medium mb-2">Frequency</label>
                  <select
                    value={formData.trigger_config.frequency || 'daily'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trigger_config: { ...formData.trigger_config, frequency: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Time</label>
                  <input
                    type="time"
                    value={formData.trigger_config.time || '09:00'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trigger_config: { ...formData.trigger_config, time: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  />
                </div>
              </div>
            )}

            {formData.trigger_type === 'roas_threshold' && (
              <div className="space-y-3 bg-muted/50 p-4 rounded">
                <div>
                  <label className="block text-sm font-medium mb-2">Operator</label>
                  <select
                    value={formData.trigger_config.operator || 'below'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trigger_config: { ...formData.trigger_config, operator: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  >
                    <option value="below">Below</option>
                    <option value="above">Above</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">ROAS Value</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 2.0"
                    value={formData.trigger_config.value || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trigger_config: { ...formData.trigger_config, value: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep('action')}
                disabled={!formData.name || !formData.trigger_type}
              >
                Next: Configure Action
              </Button>
            </div>
          </div>
        )}

        {/* Action Step */}
        {step === 'action' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-3">Action Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'pause_campaign', label: 'Pause Campaign', desc: 'Stop a campaign' },
                  { id: 'adjust_budget', label: 'Adjust Budget', desc: 'Change budget' },
                  { id: 'notify_user', label: 'Notify User', desc: 'Send notification' },
                  { id: 'create_lead', label: 'Create Lead', desc: 'Add new lead' },
                ].map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionTypeChange(action.id)}
                    className={`p-3 rounded border-2 text-left transition ${
                      formData.action_type === action.id
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Config */}
            {formData.action_type === 'pause_campaign' && (
              <div className="space-y-3 bg-muted/50 p-4 rounded">
                <div>
                  <label className="block text-sm font-medium mb-2">Campaign</label>
                  <input
                    type="text"
                    placeholder="Campaign ID"
                    value={formData.action_config.campaignId || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        action_config: { ...formData.action_config, campaignId: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  />
                </div>
              </div>
            )}

            {formData.action_type === 'adjust_budget' && (
              <div className="space-y-3 bg-muted/50 p-4 rounded">
                <div>
                  <label className="block text-sm font-medium mb-2">Campaign</label>
                  <input
                    type="text"
                    placeholder="Campaign ID"
                    value={formData.action_config.campaignId || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        action_config: { ...formData.action_config, campaignId: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Adjustment Type</label>
                  <select
                    value={formData.action_config.budgetType || 'fixed'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        action_config: { ...formData.action_config, budgetType: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Value</label>
                  <input
                    type="number"
                    placeholder={formData.action_config.budgetType === 'percentage' ? '%' : '$'}
                    value={formData.action_config.budgetValue || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        action_config: { ...formData.action_config, budgetValue: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border rounded bg-background"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('trigger')}>
                Back
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('review')}
                  disabled={!formData.action_type}
                >
                  Next: Review
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <div className="space-y-4">
            <Card className="p-4 bg-muted/50">
              <h3 className="font-semibold mb-3">Automation Summary</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{formData.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Description:</span>
                  <p className="font-medium">{formData.description || 'No description'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Trigger:</span>
                  <p className="font-medium capitalize">{formData.trigger_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Action:</span>
                  <p className="font-medium capitalize">{formData.action_type}</p>
                </div>
              </div>
            </Card>

            <div className="flex gap-3 justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('action')}>
                Back
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Create Automation
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
