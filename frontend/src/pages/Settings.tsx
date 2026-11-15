import { useState } from 'react'
import {
  Server,
  Database,
  Shield,
  Bell,
  Palette,
  Save,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useHealth, useModelInfo } from '@/hooks/useApi'
import { cn } from '@/lib/utils'

interface SettingsField {
  key: string
  label: string
  type: 'text' | 'number' | 'password' | 'checkbox' | 'select'
  value?: string
  placeholder?: string
  disabled?: boolean
  min?: string
  max?: string
  step?: string
  checked?: boolean
  options?: string[]
}

interface SettingsSection {
  title: string
  icon: React.ReactNode
  description: string
  fields: SettingsField[]
}

export function Settings() {
  const { data: health } = useHealth()
  const { data: modelInfo } = useModelInfo()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const sections: SettingsSection[] = [
    {
      title: 'Backend Connection',
      icon: <Server className="h-5 w-5" />,
      description: 'Configure API connection settings',
      fields: [
        { key: 'apiUrl', label: 'API Base URL', type: 'text', value: (import.meta as any).env?.VITE_API_URL || '/api/v1', disabled: true },
        { key: 'wsUrl', label: 'WebSocket URL', type: 'text', value: '', placeholder: 'ws://localhost:8000/ws' },
        { key: 'timeout', label: 'Request Timeout (ms)', type: 'number', value: '30000' },
      ],
    },
    {
      title: 'Model Settings',
      icon: <Database className="h-5 w-5" />,
      description: 'Model inference configuration',
      fields: [
        { key: 'defaultThreshold', label: 'Default Threshold', type: 'number', value: modelInfo?.thr?.toString() ?? '0.68', step: '0.01', min: '0', max: '1' },
        { key: 'batchSize', label: 'Default Batch Size', type: 'number', value: '32' },
        { key: 'autoThreshold', label: 'Auto-optimize Threshold', type: 'checkbox', checked: true },
      ],
    },
    {
      title: 'Data & Storage',
      icon: <Database className="h-5 w-5" />,
      description: 'Data retention and storage settings',
      fields: [
        { key: 'retentionDays', label: 'Prediction Retention (days)', type: 'number', value: '90' },
        { key: 'maxBatchSize', label: 'Max Batch Prediction Size', type: 'number', value: '1000' },
        { key: 'enableCache', label: 'Enable Response Caching', type: 'checkbox', checked: true },
      ],
    },
    {
      title: 'Security',
      icon: <Shield className="h-5 w-5" />,
      description: 'Authentication and access control',
      fields: [
        { key: 'requireAuth', label: 'Require Authentication', type: 'checkbox', checked: false },
        { key: 'apiKey', label: 'API Key', type: 'password', value: '', placeholder: 'Enter API key' },
        { key: 'allowedOrigins', label: 'Allowed CORS Origins', type: 'text', value: '*', placeholder: 'https://example.com' },
      ],
    },
    {
      title: 'Notifications',
      icon: <Bell className="h-5 w-5" />,
      description: 'Alert and notification preferences',
      fields: [
        { key: 'emailAlerts', label: 'Email Alerts on Leak Detection', type: 'checkbox', checked: false },
        { key: 'alertThreshold', label: 'Alert Probability Threshold', type: 'number', value: '0.8', step: '0.01', min: '0', max: '1' },
        { key: 'webhookUrl', label: 'Webhook URL', type: 'text', value: '', placeholder: 'https://hooks.example.com/alerts' },
      ],
    },
    {
      title: 'Appearance',
      icon: <Palette className="h-5 w-5" />,
      description: 'UI theme and display options',
      fields: [
        { key: 'theme', label: 'Theme', type: 'select', options: ['Light', 'Dark', 'System'], value: 'System' },
        { key: 'compactMode', label: 'Compact Mode', type: 'checkbox', checked: false },
        { key: 'showAnimations', label: 'Enable Animations', type: 'checkbox', checked: true },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
          <p className="text-secondary-500 mt-1">Configure PIPER leak detection system</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <Badge variant="success" className="mr-2">Saved</Badge>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
                  {section.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-secondary-900">{section.title}</h2>
                  <p className="text-sm text-secondary-500">{section.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="label">{field.label}</label>
                  {field.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={field.checked}
                        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-secondary-700">Enabled</span>
                    </label>
                  ) : field.type === 'select' ? (
                    <select
                      defaultValue={field.value}
                      className="input"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type}
                      defaultValue={field.value}
                      placeholder={field.placeholder}
                      disabled={field.disabled}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-warning-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-50 text-warning-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">Danger Zone</h2>
              <p className="text-sm text-secondary-500">Irreversible actions that affect system data</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="font-medium text-secondary-900">Clear Prediction History</p>
              <p className="text-sm text-secondary-500">Remove all stored prediction results and logs</p>
            </div>
            <Button variant="danger">Clear History</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div>
              <p className="font-medium text-secondary-900">Reset Model Cache</p>
              <p className="text-sm text-secondary-500">Force reload model artifacts from disk</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Model
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-secondary-900">System Status</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-secondary-50">
              <dt className="text-sm text-secondary-500">API Status</dt>
              <dd className={cn('font-medium flex items-center gap-2 mt-1', health?.status === 'healthy' ? 'text-success-600' : 'text-danger-600')}>
                <span className={cn('h-2 w-2 rounded-full', health?.status === 'healthy' ? 'bg-success-500' : 'bg-danger-500')} />
                {health?.status ?? 'Unknown'}
              </dd>
            </div>
            <div className="p-4 rounded-lg bg-secondary-50">
              <dt className="text-sm text-secondary-500">Model Loaded</dt>
              <dd className={cn('font-medium flex items-center gap-2 mt-1', health?.model_loaded ? 'text-success-600' : 'text-warning-600')}>
                <span className={cn('h-2 w-2 rounded-full', health?.model_loaded ? 'bg-success-500' : 'bg-warning-500')} />
                {health?.model_loaded ? 'Yes' : 'No'}
              </dd>
            </div>
            <div className="p-4 rounded-lg bg-secondary-50">
              <dt className="text-sm text-secondary-500">Model Type</dt>
              <dd className="font-medium text-secondary-900 mt-1">{health?.model_type ?? 'Unknown'}</dd>
            </div>
            <div className="p-4 rounded-lg bg-secondary-50">
              <dt className="text-sm text-secondary-500">Environment</dt>
              <dd className="font-medium text-secondary-900 mt-1">Development</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}