import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AlertTriangle, Loader2, Zap, Play, Pause, Square, FastForward, TrendingUp, AlertCircle, CheckCircle, Database, History, Brain } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useModelInfo, usePredict, useReplay } from '@/hooks/useApi'
import { useSHAP } from '@/hooks/useSHAP'
import { formatPercent, formatDateTime, formatRelativeTime } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { ForcePlot, WaterfallPlot, FeatureImportanceBar } from '@/components/shap'
import type { ReplayWindow } from '@/types/api'

const FEATURE_NAMES = [
  'Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean',
  'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume'
]

export const FEATURE_LABELS: Record<string, string> = {
  Hour: 'Hour',
  DayOfWeek: 'Day',
  Month: 'Month',
  roll6_mean: 'Roll 6 Mean',
  roll24_mean: 'Roll 24 Mean',
  roll6_std: 'Roll 6 Std',
  roll24_std: 'Roll 24 Std',
  rel_to_roll24: 'Rel to Roll 24',
  Delta_Volume: 'Delta Volume',
}

export const FEATURE_UNITS: Record<string, string> = {
  Hour: 'hr',
  DayOfWeek: 'day',
  Month: 'month',
  roll6_mean: 'm³',
  roll24_mean: 'm³',
  roll6_std: 'm³',
  roll24_std: 'm³',
  rel_to_roll24: 'ratio',
  Delta_Volume: 'm³/hr',
}

const SPEED_OPTIONS = [
  { value: 500, label: '0.5x' },
  { value: 250, label: '1x' },
  { value: 125, label: '2x' },
  { value: 50, label: '5x' },
  { value: 25, label: '10x' },
]

const WINDOW_COUNT_OPTIONS = [
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
]

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  EMERGENCY: { bg: 'bg-danger-100', text: 'text-danger-700', dot: 'bg-danger-500' },
  URGENT: { bg: 'bg-danger-50', text: 'text-danger-600', dot: 'bg-danger-500' },
  HIGH: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
  MEDIUM: { bg: 'bg-primary-50', text: 'text-primary-700', dot: 'bg-primary-500' },
  LOW: { bg: 'bg-secondary-100', text: 'text-secondary-600', dot: 'bg-secondary-400' },
  ROUTINE: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
  UNKNOWN: { bg: 'bg-secondary-100', text: 'text-secondary-600', dot: 'bg-secondary-400' },
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: 'bg-danger-100', text: 'text-danger-700', dot: 'bg-danger-500' },
  HIGH: { bg: 'bg-danger-50', text: 'text-danger-600', dot: 'bg-danger-500' },
  MEDIUM: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
  LOW: { bg: 'bg-secondary-100', text: 'text-secondary-600', dot: 'bg-secondary-400' },
  INFO: { bg: 'bg-primary-50', text: 'text-primary-700', dot: 'bg-primary-500' },
  WARNING: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
}

const THRESHOLD = 0.68

function computeActions(probability: number, prediction: number) {
  const isLeak = prediction === 1
  const prob = probability || 0
  
  let priority: string
  let slaHours: number
  let immediate: string[]
  let shortTerm: string[]
  let notifications: string[]
  let estimatedCostTier: string
  let simulatedResponse: {
    alert_type: string
    severity: string
    message: string
    channels: string[]
    auto_escalate_minutes: number
    acknowledgement_required: boolean
    escalation_contact: string
    template_id: string
  } | undefined

  if (!isLeak) {
    priority = 'LOW'
    slaHours = 24
    immediate = ['Continue monitoring']
    shortTerm = ['Review weekly trend']
    notifications = []
    estimatedCostTier = 'Low'
    simulatedResponse = undefined
  } else if (prob >= 0.9) {
    priority = 'EMERGENCY'
    slaHours = 1
    immediate = [
      'Dispatch emergency crew immediately',
      'Notify utility operations center',
      'Prepare isolation valves'
    ]
    shortTerm = [
      'Coordinate with traffic control',
      'Set up temporary water supply',
      'Begin root cause analysis'
    ]
    notifications = [
      'Alert emergency services',
      'Notify affected customers',
      'Update incident dashboard'
    ]
    estimatedCostTier = 'Critical'
    simulatedResponse = {
      alert_type: 'LEAK_DETECTED',
      severity: 'CRITICAL',
      message: 'Critical leak detected at {{meter_id}} with {{probability}} probability. Immediate action required.',
      channels: ['SMS', 'EMAIL', 'PUSH', 'WEBHOOK'],
      auto_escalate_minutes: 5,
      acknowledgement_required: true,
      escalation_contact: 'Emergency Dispatch: +1-555-EMERGENCY',
      template_id: 'LEAK_EMERGENCY_v2'
    }
  } else if (prob >= 0.8) {
    priority = 'URGENT'
    slaHours = 2
    immediate = [
      'Dispatch crew within 2 hours',
      'Notify operations center',
      'Prepare repair materials'
    ]
    shortTerm = [
      'Schedule permanent repair',
      'Monitor adjacent meters',
      'Update maintenance schedule'
    ]
    notifications = [
      'Alert on-call engineer',
      'Notify district manager'
    ]
    estimatedCostTier = 'High'
    simulatedResponse = {
      alert_type: 'LEAK_DETECTED',
      severity: 'HIGH',
      message: 'High probability leak at {{meter_id}} ({{probability}}). Urgent response needed.',
      channels: ['SMS', 'EMAIL', 'PUSH'],
      auto_escalate_minutes: 15,
      acknowledgement_required: true,
      escalation_contact: 'On-Call Engineer: +1-555-ONCALL',
      template_id: 'LEAK_URGENT_v2'
    }
  } else if (prob >= 0.7) {
    priority = 'HIGH'
    slaHours = 4
    immediate = [
      'Schedule inspection within 4 hours',
      'Verify with secondary sensors',
      'Log in maintenance system'
    ]
    shortTerm = [
      'Plan repair within 24 hours',
      'Increase monitoring frequency',
      'Check historical patterns'
    ]
    notifications = [
      'Notify maintenance team',
      'Log in CMMS'
    ]
    estimatedCostTier = 'Medium'
    simulatedResponse = {
      alert_type: 'LEAK_DETECTED',
      severity: 'HIGH',
      message: 'Leak detected at {{meter_id}} with {{probability}} probability. Schedule inspection.',
      channels: ['EMAIL', 'PUSH'],
      auto_escalate_minutes: 30,
      acknowledgement_required: true,
      escalation_contact: 'Maintenance Lead: +1-555-MAINT',
      template_id: 'LEAK_HIGH_v2'
    }
  } else {
    priority = 'MEDIUM'
    slaHours = 8
    immediate = [
      'Schedule inspection within 8 hours',
      'Log in maintenance system',
      'Increase monitoring'
    ]
    shortTerm = [
      'Plan repair within 48 hours',
      'Review sensor calibration',
      'Check for pattern changes'
    ]
    notifications = [
      'Log in CMMS'
    ]
    estimatedCostTier = 'Low'
    simulatedResponse = {
      alert_type: 'LEAK_DETECTED',
      severity: 'MEDIUM',
      message: 'Potential leak at {{meter_id}} ({{probability}}). Investigation recommended.',
      channels: ['EMAIL'],
      auto_escalate_minutes: 60,
      acknowledgement_required: false,
      escalation_contact: 'Maintenance Team: +1-555-TEAM',
      template_id: 'LEAK_MEDIUM_v2'
    }
  }

  return {
    immediate,
    short_term: shortTerm,
    notifications,
    priority,
    sla_hours: slaHours,
    estimated_cost_tier: estimatedCostTier,
    simulated_response: simulatedResponse
  }
}

export function Replay() {
  const { data: modelInfo, isLoading: modelLoading } = useModelInfo()

  const { data: replayWindows, isLoading: loadingWindows, loadReplayData, error: windowsError } = useReplay()
  const { predict: predictMutation } = usePredict()
  const { data: shapData, isLoading: shapLoading, explain: explainSHAP, clear: clearSHAP } = useSHAP()

  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(250)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<ReplayWindow[]>([])
  const [selectedMeterIds, setSelectedMeterIds] = useState<string[]>([])
  const [windowCount, setWindowCount] = useState(50)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['roll6_mean', 'roll24_mean', 'Delta_Volume'])
  const [showSHAP, setShowSHAP] = useState(false)
  const [selectedTimestep, setSelectedTimestep] = useState(47)

  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const knownMetersRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    loadReplayData(windowCount, selectedMeterIds)
  }, [selectedMeterIds, windowCount])

  useEffect(() => {
    if (!isPlaying) return

    let cancelled = false

    const step = async () => {
      if (cancelled) return
      if (!isMountedRef.current || !isPlaying) return

      const windows = replayWindows ?? []
      if (currentIndex >= windows.length) {
        setIsPlaying(false)
        return
      }

      const win = windows[currentIndex]
      try {
        const request = {
          windows: [win.features],
          feature_cols: FEATURE_NAMES,
          thr: THRESHOLD,
        }
        const prediction = await predictMutation(request)

        const prob = prediction.probs[0]
        const pred = prediction.preds[0]
        const actions = computeActions(prob, pred)

        const result: ReplayWindow = {
          ...win,
          probability: prob,
          prediction: pred,
          actions,
          metadata: { degradation_tier: prob >= 0.8 ? 'severe' : prob >= 0.7 ? 'moderate' : 'mild' },
        }

        setResults(prev => [...prev, result])
        setCurrentIndex(prev => prev + 1)
      } catch (err) {
        console.error('Prediction failed:', err)
        setResults(prev => [...prev, { ...win, probability: 0, prediction: 0 }])
        setCurrentIndex(prev => prev + 1)
      }

      if (isMountedRef.current && isPlaying && currentIndex + 1 < (replayWindows ?? []).length) {
        animationTimeoutRef.current = setTimeout(() => {
          if (!cancelled) step()
        }, speed)
      } else {
        setIsPlaying(false)
      }
    }

    step()

    return () => {
      cancelled = true
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
        animationTimeoutRef.current = null
      }
    }
  }, [isPlaying, replayWindows, currentIndex, speed, predictMutation])

  useEffect(() => {
    setResults([])
    setCurrentIndex(0)
    setIsPlaying(false)
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }
  }, [replayWindows])

  useEffect(() => {
    if (replayWindows) {
      replayWindows.forEach(w => knownMetersRef.current.add(w.meter_id))
    }
  }, [replayWindows])

  const currentWindow = results.length ? results[results.length - 1] : null

  // SHAP explanation effect - triggers when currentWindow changes and SHAP panel is open
  useEffect(() => {
    if (currentWindow && showSHAP) {
      const timer = setTimeout(async () => {
        try {
          await explainSHAP({
            windows: [currentWindow.features],
            feature_cols: FEATURE_NAMES,
            method: 'tree'
          })
          setSelectedTimestep(currentWindow.features.length - 1)
        } catch (err) {
          console.error('SHAP explanation failed:', err)
        }
      }, 300)
      return () => clearTimeout(timer)
    } else {
      clearSHAP()
    }
  }, [currentWindow, showSHAP, explainSHAP, clearSHAP])

  const availableMeters = useMemo(() => {
    return Array.from(knownMetersRef.current).sort()
  }, [replayWindows])

  const chartData = useMemo(() => {
    if (!currentWindow) return []
    return currentWindow.features.map((step, idx) => {
      const obj: Record<string, number | string> = { step: idx }
      FEATURE_NAMES.forEach((name, i) => {
        obj[name] = step[i]
      })
      return obj
    })
  }, [currentWindow])

  const chartLines = useMemo(() => {
    return selectedFeatures.map((feature, idx) => ({
      feature,
      label: FEATURE_LABELS[feature] || feature,
      unit: FEATURE_UNITS[feature] || '',
      color: ['#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#84cc16'][idx % 9],
    }))
  }, [selectedFeatures])

  const handlePlay = useCallback(() => {
    if ((replayWindows?.length ?? 0) === 0) return
    setIsPlaying(true)
  }, [replayWindows])

  const handlePause = useCallback(() => setIsPlaying(false), [])

  const handleStop = useCallback(() => {
    setIsPlaying(false)
    setCurrentIndex(0)
    setResults([])
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }
  }, [])

  const handleMeterChange = useCallback((meterIds: string[]) => {
    setSelectedMeterIds(meterIds)
  }, [])

  const handleWindowCountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setWindowCount(parseInt(e.target.value))
  }, [])

  const handleSpeedSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSpeed(parseInt(e.target.value))
  }, [])

  const handleStepForward = useCallback(async () => {
    if (!isPlaying && currentIndex < (replayWindows?.length ?? 0)) {
      const windows = replayWindows ?? []
      const win = windows[currentIndex]
      try {
        const request = {
          windows: [win.features],
          feature_cols: FEATURE_NAMES,
          thr: THRESHOLD,
        }
        const prediction = await predictMutation(request)

        const prob = prediction.probs[0]
        const pred = prediction.preds[0]
        const actions = computeActions(prob, pred)

        const result: ReplayWindow = {
          ...win,
          probability: prob,
          prediction: pred,
          actions,
          metadata: { degradation_tier: prob >= 0.8 ? 'severe' : prob >= 0.7 ? 'moderate' : 'mild' },
        }

        setResults(prev => [...prev, result])
        setCurrentIndex(prev => prev + 1)
      } catch (err) {
        console.error('Prediction failed:', err)
        setResults(prev => [...prev, { ...win, probability: 0, prediction: 0 }])
        setCurrentIndex(prev => prev + 1)
      }
    }
  }, [isPlaying, currentIndex, replayWindows, predictMutation])

  if (modelLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-secondary-900 truncate">Live Telemetry Monitoring</h1>
          <p className="text-secondary-500 mt-1">Replay historical telemetry with real-time leak detection</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info" dot className="text-sm">
            Model: {modelInfo?.model || 'GRU'}
          </Badge>
          <Badge variant="info" dot className="text-sm">
            Window: {modelInfo?.window || 48}h
          </Badge>
        </div>
      </div>

      {windowsError && (
        <Card className="border-danger-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-danger-50 border border-danger-200">
              <AlertTriangle className="h-5 w-5 text-danger-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-danger-900">Failed to Load Data</p>
                <p className="text-sm text-danger-700">{windowsError.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-secondary-900">Replay Controls</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary-600">Meters:</label>
              <Select
                value={selectedMeterIds.join(',') || 'all'}
                onChange={(e) => handleMeterChange(e.target.value === 'all' ? [] : e.target.value.split(','))}
              >
                <option value="all">All Meters</option>
                {availableMeters.map(meter => (
                  <option key={meter} value={meter}>{meter}</option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary-600">Windows:</label>
              <Select value={windowCount.toString()} onChange={handleWindowCountChange}>
                {WINDOW_COUNT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value.toString()}>{opt.label}</option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary-600">Speed:</label>
              <Select value={speed.toString()} onChange={handleSpeedSelectChange}>
                {SPEED_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value.toString()}>{opt.label}</option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2 border-l border-secondary-200 pl-4 ml-2">
              <Button variant="outline" size="sm" onClick={handleStop} disabled={!isPlaying && currentIndex === 0 && results.length === 0} title="Stop">
                <Square className="h-5 w-5" />
              </Button>
              <Button variant={isPlaying ? 'outline' : 'primary'} size="sm" onClick={isPlaying ? handlePause : handlePlay} disabled={!(replayWindows?.length ?? 0)} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleStepForward} title="Step Forward" disabled={isPlaying || currentIndex >= (replayWindows?.length ?? 0)}>
                <FastForward className="h-5 w-5" />
              </Button>
            </div>

            {(replayWindows?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-secondary-500">
                  {currentIndex} / {replayWindows!.length}
                </span>
                <div className="w-48 h-2 bg-secondary-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 transition-all duration-100"
                    style={{ width: `${(currentIndex / replayWindows!.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {replayWindows?.length === 0 && !loadingWindows && (
            <div className="text-center py-12 text-secondary-500">
              <Database className="h-12 w-12 mx-auto text-secondary-300 mb-4" />
              <p className="text-lg font-medium">No data loaded</p>
              <p className="text-sm mt-1">Select meters and press Play to begin</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-secondary-900">Live Telemetry</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm text-secondary-600">Features:</label>
                <div className="flex flex-wrap gap-1">
                  {FEATURE_NAMES.slice(0, 6).map(feature => (
                    <label key={feature} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(feature)}
                        onChange={(e) => {
                          setSelectedFeatures(prev =>
                            e.target.checked
                              ? [...prev, feature]
                              : prev.filter(f => f !== feature)
                          )
                        }}
                        className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-xs text-secondary-600">{FEATURE_LABELS[feature]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {currentWindow ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="step"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(v) => `t=${v}`}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number, name: string) => [
                          typeof value === 'number' ? value.toFixed(3) : value,
                          name,
                        ]}
                      />
                      <Legend />
                      {chartLines.map((line) => (
                        <Line
                          key={line.feature}
                          type="monotone"
                          dataKey={line.feature}
                          stroke={line.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6 }}
                          name={`${line.label} (${line.unit})`}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-secondary-400">
                  <div className="text-center">
                    <Zap className="h-12 w-12 mx-auto text-secondary-300 mb-4" />
                    <p className="text-lg font-medium">No telemetry data</p>
                    <p className="text-sm mt-1">Start replay to see live telemetry</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {currentWindow && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-secondary-900">Current Window</h2>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-secondary-500">Meter ID</p>
                    <p className="font-mono text-lg truncate">{currentWindow.meter_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Timestamp</p>
                    <p className="font-mono text-lg">{formatDateTime(currentWindow.timestamp_end)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Step</p>
                    <p className="font-mono text-lg">t = {currentIndex}</p>
                  </div>
                  {currentWindow.y_true !== undefined && (
                    <div className="md:col-span-3">
                      <p className="text-sm text-secondary-500">Ground Truth</p>
                      <Badge variant={currentWindow.y_true === 1 ? 'danger' : 'success'} dot className="text-lg px-4 py-2">
                        {currentWindow.y_true === 1 ? 'Actual Leak' : 'Normal'}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6 min-w-0">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-secondary-900">Leak Detection</h2>
              <Button
                variant={showSHAP ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setShowSHAP(!showSHAP)}
                disabled={!currentWindow}
                title={showSHAP ? 'Hide SHAP Explainability' : 'Show SHAP Explainability'}
              >
                <Brain className="h-4 w-4 mr-1" />
                SHAP
              </Button>
            </CardHeader>
            <CardContent>
              {currentWindow ? (
                <div>
                  <div className="text-center mb-6">
                    {getPredictionBadge(currentWindow.probability, currentWindow.prediction)}
                    <p className="text-sm text-secondary-500 mt-2">Leak Probability</p>
                    <div className="mt-4 h-3 bg-secondary-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-success-500 via-warning-500 to-danger-500 rounded-full transition-all duration-300"
                        style={{ width: `${(currentWindow.probability || 0) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-secondary-400 mt-1">
                      <span>0%</span>
                      <span className="font-medium">{formatPercent(THRESHOLD)}</span>
                      <span>100%</span>
                    </div>
                    <p className="text-xs text-secondary-400 mt-2">
                      {currentWindow.probability !== undefined
                        ? (currentWindow.probability >= THRESHOLD ? 'Above threshold → Leak' : 'Below threshold → Normal')
                        : 'Waiting for prediction...'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-secondary-400">
                  <Zap className="h-12 w-12 mx-auto text-secondary-300 mb-4" />
                  <p className="text-lg font-medium">No prediction yet</p>
                  <p className="text-sm mt-1">Start replay to see predictions</p>
                </div>
              )}

              {currentWindow?.actions && (
                <div className="mt-6 space-y-4">
                  <div className="pt-4 border-t border-secondary-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-secondary-900">Decision</h3>
                      {getPriorityBadge(currentWindow.actions.priority)}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="p-3 rounded-lg bg-secondary-50">
                        <p className="text-xs text-secondary-500 uppercase tracking-wide mb-1">Priority</p>
                        <p className="font-medium text-secondary-900">{currentWindow.actions.priority}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary-50">
                        <p className="text-xs text-secondary-500 uppercase tracking-wide mb-1">SLA</p>
                        <p className="font-medium text-secondary-900">{currentWindow.actions.sla_hours}h</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-secondary-700">Immediate Actions</h4>
                      <ul className="space-y-1 text-sm text-secondary-600">
                        {currentWindow.actions.immediate.map((action, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-success-500 flex-shrink-0" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-secondary-700">Short-term Actions</h4>
                      <ul className="space-y-1 text-sm text-secondary-600">
                        {currentWindow.actions.short_term.map((action, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary-500 flex-shrink-0" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {currentWindow.actions.notifications.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-secondary-700">Notifications</h4>
                        <ul className="space-y-1 text-sm text-secondary-600">
                          {currentWindow.actions.notifications.map((notification, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-warning-500 flex-shrink-0" />
                              {notification}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentWindow?.actions?.simulated_response && (
                <Card className="mt-4 border-primary-200 bg-primary-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-6 w-6 text-primary-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-secondary-900">Simulated Alert</h4>
                          {getSeverityBadge(currentWindow.actions.simulated_response.severity)}
                          <Badge variant="info" size="sm">{currentWindow.actions.simulated_response.alert_type}</Badge>
                        </div>
                        <p className="text-sm text-secondary-700 mb-3">
                          {interpolateMessage(currentWindow.actions.simulated_response.message, currentWindow)}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3 text-xs">
                          <div className="p-2 rounded bg-white border border-secondary-200">
                            <p className="text-secondary-400">Channels</p>
                            <p className="font-mono text-secondary-900 truncate">
                              {currentWindow.actions.simulated_response.channels.join(', ') || 'None'}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-white border border-secondary-200">
                            <p className="text-secondary-400">Auto-escalate</p>
                            <p className="font-mono text-secondary-900">
                              {currentWindow.actions.simulated_response.auto_escalate_minutes > 0
                                ? `${currentWindow.actions.simulated_response.auto_escalate_minutes} min`
                                : 'Disabled'}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-white border border-secondary-200">
                            <p className="text-secondary-400">Ack Required</p>
                            <p className="font-mono text-secondary-900">
                              {currentWindow.actions.simulated_response.acknowledgement_required ? 'Yes' : 'No'}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-white border border-secondary-200 sm:col-span-2">
                            <p className="text-secondary-400">Escalation Contact</p>
                            <p className="font-mono text-secondary-900 truncate">
                              {currentWindow.actions.simulated_response.escalation_contact}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-white border border-secondary-200">
                            <p className="text-secondary-400">Template ID</p>
                            <p className="font-mono text-secondary-900 truncate">
                              {currentWindow.actions.simulated_response.template_id}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* SHAP Explainability Panel */}
              {showSHAP && currentWindow && (
                <Card className="mt-4 border-primary-200 bg-primary-50">
                  <CardHeader className="flex items-center justify-between">
                    <h3 className="font-semibold text-secondary-900">SHAP Explainability</h3>
                    <div className="flex items-center gap-2">
                      {shapLoading && <span className="text-xs text-secondary-500">Computing...</span>}
                      <label className="text-sm text-secondary-600">Timestep:</label>
                      <select
                        className="border rounded px-2 py-1 text-sm text-secondary-900"
                        value={selectedTimestep}
                        onChange={(e) => setSelectedTimestep(parseInt(e.target.value))}
                        disabled={!shapData || shapLoading}
                      >
                        {shapData?.shap_values.map((_, i) => (
                          <option key={i} value={i}>
                            t = {i} (t-{shapData.shap_values.length - 1 - i}h ago)
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {shapLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                        <span className="ml-3 text-secondary-600">Computing SHAP values...</span>
                      </div>
                    ) : shapData ? (
                      <>
                        {/* Force Plot */}
                        <ForcePlot
                          shapValues={shapData.shap_values[selectedTimestep]}
                          featureNames={shapData.feature_names}
                          baseValue={shapData.base_value}
                          prediction={currentWindow.probability || 0}
                          featureValues={shapData.data[selectedTimestep]}
                        />

                        {/* Waterfall + Feature Importance side by side */}
                        <div className="grid gap-6 lg:grid-cols-2">
                          <WaterfallPlot
                            shapValues={shapData.shap_values[selectedTimestep]}
                            featureNames={shapData.feature_names}
                            baseValue={shapData.base_value}
                            prediction={currentWindow.probability || 0}
                            featureValues={shapData.data[selectedTimestep]}
                          />
                          <FeatureImportanceBar
                            aggregatedImportance={shapData.aggregated_importance}
                          />
                        </div>

                        {/* Timestep context */}
                        <div className="p-3 rounded-lg bg-white border border-secondary-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-secondary-600">
                              Showing timestep <strong>t = {selectedTimestep}</strong> 
                              ({shapData.shap_values.length - 1 - selectedTimestep}h lookback)
                            </span>
                            <span className="text-secondary-500">
                              Features: {shapData.feature_names.length} | 
                              Base: {shapData.base_value.toFixed(4)} → 
                              Pred: {(currentWindow.probability || 0).toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-secondary-400">
                        <Brain className="h-12 w-12 mx-auto text-secondary-300 mb-4" />
                        <p className="text-lg font-medium">No SHAP explanation available</p>
                        <p className="text-sm mt-1">Click the SHAP button to compute feature contributions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg font-semibold text-secondary-900">Event History</h2>
              <div className="flex items-center gap-2">
                <Badge variant={results.length > 0 ? 'success' : 'neutral'} dot className="text-sm">
                  {results.length} events
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-8 text-secondary-400">
                  <History className="h-12 w-12 mx-auto text-secondary-300 mb-4" />
                  <p className="text-lg font-medium">No events yet</p>
                  <p className="text-sm mt-1">Start replay to record events</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary-50 border-b border-secondary-200">
                        <th className="px-3 py-2 text-left font-medium text-secondary-500">Time</th>
                        <th className="px-3 py-2 text-left font-medium text-secondary-500">Meter</th>
                        <th className="px-3 py-2 text-center font-medium text-secondary-500">Prob</th>
                        <th className="px-3 py-2 text-center font-medium text-secondary-500">Pred</th>
                        <th className="px-3 py-2 text-center font-medium text-secondary-500">Priority</th>
                        <th className="px-3 py-2 text-left font-medium text-secondary-500">Alert</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100">
                      {[...results].reverse().slice(0, 50).map((result, idx) => (
                        <tr key={`${result.meter_id}-${result.timestamp_end}-${idx}`} className="hover:bg-secondary-50">
                          <td className="px-3 py-2 text-secondary-600 font-mono text-xs">
                            {formatRelativeTime(result.timestamp_end)}
                          </td>
                          <td className="px-3 py-2 text-secondary-900 font-mono text-xs truncate max-w-[120px]">
                            {result.meter_id}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-secondary-900">
                            {result.probability !== undefined ? formatPercent(result.probability) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge
                              variant={result.prediction === 1 ? 'danger' : 'success'}
                              size="sm"
                              dot
                            >
                              {result.prediction === 1 ? 'Leak' : 'Normal'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {result.actions ? (
                              <Badge
                                variant="default"
                                dot
                                className={PRIORITY_COLORS[result.actions.priority]?.dot
                                  ? `${PRIORITY_COLORS[result.actions.priority].bg} ${PRIORITY_COLORS[result.actions.priority].text}`
                                  : 'bg-secondary-100 text-secondary-600'}
                              >
                                {result.actions.priority}
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">-</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-secondary-600 text-xs truncate max-w-[150px]">
                            {result.actions?.simulated_response
                              ? interpolateMessage(result.actions.simulated_response.message, result).substring(0, 60) + '...'
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.length > 50 && (
                    <p className="text-xs text-secondary-500 text-center mt-3">
                      Showing latest 50 of {results.length} events
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function getPredictionBadge(probability?: number, prediction?: number) {
  if (probability === undefined || prediction === undefined) {
    return <Badge variant="neutral" dot>Waiting</Badge>
  }
  return (
    <Badge variant={prediction === 1 ? 'danger' : 'success'} dot className="text-lg px-4 py-2">
      {prediction === 1 ? 'LEAK' : 'NORMAL'}
    </Badge>
  )
}

function getPriorityBadge(priority?: string) {
  if (!priority) return <Badge variant="neutral">Unknown</Badge>
  const colors = PRIORITY_COLORS[priority] || { bg: 'bg-secondary-100', text: 'text-secondary-600', dot: 'bg-secondary-400' }
  return (
    <Badge variant="default" dot className={`${colors.bg} ${colors.text}`}>
      {priority}
    </Badge>
  )
}

function getSeverityBadge(severity?: string) {
  if (!severity) return <Badge variant="neutral">Unknown</Badge>
  const colors = SEVERITY_COLORS[severity] || { bg: 'bg-secondary-100', text: 'text-secondary-600', dot: 'bg-secondary-400' }
  return (
    <Badge variant="default" dot className={`${colors.bg} ${colors.text}`}>
      {severity}
    </Badge>
  )
}

function interpolateMessage(message: string, window: ReplayWindow) {
  return message
    .replace(/\{\{meter_id\}\}/g, window.meter_id)
    .replace(/\{\{probability(?:\.1%)?\}\}/g, window.probability !== undefined ? `${(window.probability * 100).toFixed(1)}%` : 'N/A')
    .replace(/\{\{degradation_tier\}\}/g, window.metadata?.degradation_tier as string || 'N/A')
}