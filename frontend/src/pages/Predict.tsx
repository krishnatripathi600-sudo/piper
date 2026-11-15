import { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, Zap, FileText, Trash2, Download, Database, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useModelInfo, usePredict, useSampleWindows } from '@/hooks/useApi'
import { cn, formatPercent, formatDateTime } from '@/lib/utils'
import type { PredictRequest, SampleWindow } from '@/types/api'

const FEATURE_NAMES = [
  'Hour',
  'DayOfWeek',
  'Month',
  'roll6_mean',
  'roll24_mean',
  'roll6_std',
  'roll24_std',
  'rel_to_roll24',
  'Delta_Volume',
]

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  Hour: 'Hour of day (0-23)',
  DayOfWeek: 'Day of week (0-6, Mon=0)',
  Month: 'Month (1-12)',
  roll6_mean: '6-hour rolling mean of ΔVolume',
  roll24_mean: '24-hour rolling mean of ΔVolume',
  roll6_std: '6-hour rolling std of ΔVolume',
  roll24_std: '24-hour rolling std of ΔVolume',
  rel_to_roll24: 'ΔVolume / 24h rolling mean',
  Delta_Volume: 'Hourly volume difference',
}

export function Predict() {
  const { data: modelInfo, isLoading: modelLoading, isRefreshing: modelRefreshing } = useModelInfo()
  const { predict, isLoading, data: prediction, error } = usePredict()
  const { data: samples, isLoading: samplesLoading, isRefreshing: samplesRefreshing } = useSampleWindows(3)

  const [windowSize, setWindowSize] = useState(modelInfo?.window ?? 48)
  const [threshold, setThreshold] = useState(modelInfo?.thr ?? 0.5)
  const [inputMethod, setInputMethod] = useState<'manual' | 'sample' | 'json'>('manual')
  const [manualFeatures, setManualFeatures] = useState<number[][]>(
    Array.from({ length: windowSize }, () => Array(FEATURE_NAMES.length).fill(0))
  )
  const [jsonInput, setJsonInput] = useState('')
  const [selectedSample, setSelectedSample] = useState<SampleWindow | null>(null)
  const [showFeatureInfo, setShowFeatureInfo] = useState(false)

  // Update manual features when window size changes
  useEffect(() => {
    setManualFeatures(
      Array.from({ length: windowSize }, () => Array(FEATURE_NAMES.length).fill(0))
    )
  }, [windowSize])

  const handleManualPredict = async () => {
    const request: PredictRequest = {
      windows: [manualFeatures],
      feature_cols: FEATURE_NAMES,
      thr: threshold,
    }
    try {
      await predict(request)
    } catch (err) {
      console.error('Prediction failed:', err)
    }
  }

  const handleSamplePredict = async (sample: SampleWindow) => {
    setSelectedSample(sample)
    const request: PredictRequest = {
      windows: [sample.features],
      feature_cols: FEATURE_NAMES,
      thr: threshold,
    }
    try {
      await predict(request)
    } catch (err) {
      console.error('Prediction failed:', err)
    }
  }

  const handleJsonPredict = async () => {
    try {
      const parsed = JSON.parse(jsonInput)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Expected array of windows')
      }
      const request: PredictRequest = {
        windows: parsed,
        feature_cols: FEATURE_NAMES,
        thr: threshold,
      }
      await predict(request)
    } catch (err) {
      console.error('Invalid JSON:', err)
      alert('Invalid JSON format. Expected array of windows [[[features...], ...]]')
    }
  }

  const downloadSampleJson = (sample: SampleWindow) => {
    const data = {
      windows: [sample.features],
      feature_cols: FEATURE_NAMES,
      thr: threshold,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sample-${sample.meter_id}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (modelLoading || !modelInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 min-w-0">
      {modelRefreshing && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium shadow-lg animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Updating model info...
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-secondary-900 truncate">Live Prediction</h1>
          <p className="text-secondary-500 mt-1">Test the GRU leak detection model with sensor data windows</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info" dot className="text-sm">
            Window: {windowSize}h × {FEATURE_NAMES.length} features
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg font-semibold text-secondary-900 truncate">Input Data</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-secondary-600">
                  <input
                    type="checkbox"
                    checked={showFeatureInfo}
                    onChange={(e) => setShowFeatureInfo(e.target.checked)}
                    className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  Show feature info
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex flex-wrap gap-2 mb-4" role="tablist">
                  {(['manual', 'sample', 'json'] as const).map((method) => (
                    <button
                      key={method}
                      role="tab"
                      aria-selected={inputMethod === method}
                      onClick={() => setInputMethod(method)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                        inputMethod === method
                          ? 'bg-primary-600 text-white'
                          : 'text-secondary-600 hover:bg-secondary-100'
                      )}
                    >
                      {method === 'manual' && <Zap className="h-4 w-4 inline mr-1" />}
                      {method === 'sample' && <Database className="h-4 w-4 inline mr-1" />}
                      {method === 'json' && <FileText className="h-4 w-4 inline mr-1" />}
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </button>
                  ))}
                </div>

                {inputMethod === 'manual' && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input
                        label="Window Size (hours)"
                        type="number"
                        value={windowSize}
                        onChange={(e) => setWindowSize(Math.max(1, Math.min(168, parseInt(e.target.value) || 1)))}
                        min={1}
                        max={168}
                      />
                      <Input
                        label="Threshold"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={threshold}
                        onChange={(e) => setThreshold(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                      />
                      <div className="flex items-end">
                        <Button onClick={handleManualPredict} disabled={isLoading} className="w-full sm:w-auto">
                          {isLoading ? <Loader2 className="h-4 w-4" /> : 'Predict'}
                        </Button>
                      </div>
                    </div>

                    {showFeatureInfo && (
                      <div className="rounded-lg bg-secondary-50 p-4 text-sm">
                        <p className="font-medium text-secondary-700 mb-2">Feature Order (must match training):</p>
                        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-secondary-600">
                          {FEATURE_NAMES.map((name) => (
                            <li key={name} className="flex gap-2 min-w-0">
                              <span className="font-mono font-medium truncate">{name}</span>
                              <span className="truncate">{FEATURE_DESCRIPTIONS[name]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="rounded-lg border border-secondary-200 bg-white overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] text-sm">
                          <thead>
                            <tr className="bg-secondary-50 border-b border-secondary-200">
                              <th className="sticky left-0 px-3 py-2 text-left font-medium text-secondary-500 w-12">Step</th>
                              {FEATURE_NAMES.map((name, _i) => (
                                <th key={name} className="px-2 py-2 text-center font-medium text-secondary-500 uppercase tracking-wider min-w-[80px]">
                                  {name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {manualFeatures.map((row, rowIdx) => (
                              <tr key={rowIdx} className="border-b border-secondary-100 hover:bg-secondary-50">
                                <td className="sticky left-0 px-3 py-1.5 font-mono text-secondary-500 w-12">
                                  t={rowIdx}
                                </td>
                                {row.map((val, colIdx) => (
                                  <td key={colIdx} className="px-2 py-1.5 text-center">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={val}
                                      onChange={(e) => {
                                        const newRow = [...row]
                                        newRow[colIdx] = parseFloat(e.target.value) || 0
                                        const newFeatures = [...manualFeatures]
                                        newFeatures[rowIdx] = newRow
                                        setManualFeatures(newFeatures)
                                      }}
                                      className="w-full px-2 py-1 text-center text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-transparent"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {inputMethod === 'sample' && (
                  <div className="space-y-4">
                    <p className="text-secondary-600">
                      Select a sample window from the test set to test the model.
                    </p>
                    {samplesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                      </div>
                    ) : samplesRefreshing && samples?.windows.length ? (
                      <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium shadow-lg animate-pulse">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Refreshing samples...
                      </div>
                    ) : !samples?.windows.length ? (
                      <div className="text-center py-8 text-secondary-500">
                        No sample windows available
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {samples.windows.map((sample) => (
                          <button
                            key={`${sample.meter_id}-${sample.timestamp_end}`}
                            onClick={() => handleSamplePredict(sample)}
                            disabled={isLoading}
                            className={cn(
                              'p-4 rounded-lg border transition-all text-left min-w-0',
                              selectedSample?.meter_id === sample.meter_id &&
                              selectedSample?.timestamp_end === sample.timestamp_end
                                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
                                : 'border-secondary-200 hover:border-secondary-300 hover:bg-secondary-50'
                            )}
                          >
                            <div className="flex items-center justify-between mb-2 min-w-0">
                              <span className="font-medium text-secondary-900 truncate">{sample.meter_id}</span>
                              <Badge variant={sample.y_true === 1 ? 'danger' : 'success'} dot size="sm">
                                {sample.y_true === 1 ? 'Actual Leak' : 'Normal'}
                              </Badge>
                            </div>
                            <p className="text-sm text-secondary-500">{formatDateTime(sample.timestamp_end)}</p>
                            <p className="text-xs text-secondary-400 mt-1">{sample.features.length} steps × {sample.features[0]?.length} features</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedSample && (
                      <div className="p-4 rounded-lg bg-secondary-50 border border-secondary-200 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <span className="font-medium truncate">Selected: {selectedSample.meter_id}</span>
                          <Button variant="ghost" size="sm" onClick={() => downloadSampleJson(selectedSample!)}>
                            <Download className="h-4 w-4 mr-1" />
                            Download JSON
                          </Button>
                        </div>
                        <Button onClick={() => handleSamplePredict(selectedSample!)} disabled={isLoading} className="w-full sm:w-auto">
                          {isLoading ? <Loader2 className="h-4 w-4" /> : 'Predict on Selected Sample'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {inputMethod === 'json' && (
                  <div className="space-y-4 min-w-0">
                    <p className="text-secondary-600">
                      Paste a JSON array of windows with shape <code className="bg-secondary-100 px-1 rounded">[[[f1,f2,...], ...], ...]</code>
                    </p>
                    <Textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder='[[[0.1, 0.2, ...], [0.3, 0.4, ...], ...]]'
                      rows={10}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleJsonPredict} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4" /> : 'Predict from JSON'}
                      </Button>
                      <Button variant="outline" onClick={() => setJsonInput('')}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>
                    <details className="text-sm text-secondary-500">
                      <summary className="cursor-pointer">Example format</summary>
                      <pre className="mt-2 p-3 rounded bg-secondary-100 text-xs overflow-x-auto">
{JSON.stringify({ windows: [Array.from({ length: 3 }, () => Array(9).fill(0))], feature_cols: FEATURE_NAMES, thr: 0.68 }, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {prediction && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-secondary-900">Prediction Result</h2>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className={cn(
                    'p-6 rounded-xl text-center',
                    prediction.preds[0] === 1 ? 'bg-danger-50' : 'bg-success-50'
                  )}>
                    <div className={cn('text-4xl font-bold', prediction.preds[0] === 1 ? 'text-danger-600' : 'text-success-600')}>
                      {formatPercent(prediction.probs[0])}
                    </div>
                    <p className="text-sm text-secondary-500 mt-1">Leak Probability</p>
                    <Badge variant={prediction.preds[0] === 1 ? 'danger' : 'success'} dot className="mt-3">
                      {prediction.preds[0] === 1 ? 'Leak Detected' : 'No Leak'}
                    </Badge>
                  </div>

                  <div className="p-6 rounded-xl bg-secondary-50 text-center">
                    <p className="text-sm text-secondary-500">Threshold Used</p>
                    <p className="text-3xl font-bold text-secondary-900 mt-1">
                      {formatPercent(prediction.thr)}
                    </p>
                    <p className="text-xs text-secondary-400 mt-1">
                      {prediction.probs[0] >= prediction.thr ? 'Above threshold → Leak' : 'Below threshold → Normal'}
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-white border border-secondary-200 text-center">
                    <p className="text-sm text-secondary-500">Decision</p>
                    <p className="text-3xl font-bold text-secondary-900 mt-1">
                      {prediction.preds[0] === 1 ? 'LEAK' : 'NORMAL'}
                    </p>
                    <div className="mt-3 h-2 w-full bg-secondary-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          prediction.preds[0] === 1 ? 'bg-danger-500' : 'bg-success-500'
                        )}
                        style={{ width: `${prediction.probs[0] * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-secondary-400 mt-1">
                      <span>0%</span>
                      <span className="font-medium">{formatPercent(prediction.thr)}</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {selectedSample && (
                  <div className="mt-6 p-4 rounded-lg bg-secondary-50 border border-secondary-200">
                    <h3 className="font-medium text-secondary-900 mb-2">Ground Truth Comparison</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-sm text-secondary-500">Actual Label</p>
                        <p className="font-mono text-lg">{selectedSample.y_true === 1 ? 'Leak' : 'Normal'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-500">Predicted</p>
                        <p className="font-mono text-lg">{prediction.preds[0] === 1 ? 'Leak' : 'Normal'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-500">Match</p>
                        <Badge variant={selectedSample.y_true === prediction.preds[0] ? 'success' : 'danger'} dot>
                          {selectedSample.y_true === prediction.preds[0] ? 'Correct' : 'Incorrect'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-danger-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-danger-50 border border-danger-200">
                  <AlertTriangle className="h-5 w-5 text-danger-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-danger-900">Prediction Error</p>
                    <p className="text-sm text-danger-700">{error.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-secondary-900">Model Info</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Architecture</dt>
                  <dd className="font-mono text-secondary-900 truncate">{modelInfo.model}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Window Size</dt>
                  <dd className="font-mono text-secondary-900 truncate">{modelInfo.window}h</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Features</dt>
                  <dd className="font-mono text-secondary-900 truncate">{modelInfo.in_dim}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Hidden Units</dt>
                  <dd className="font-mono text-secondary-900 truncate">{modelInfo.hidden}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Layers</dt>
                  <dd className="font-mono text-secondary-900 truncate">{modelInfo.num_layers}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Bidirectional</dt>
                  <dd className="font-mono text-secondary-900 truncate">{modelInfo.bidirectional ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Dropout</dt>
                  <dd className="font-mono text-secondary-900 truncate">{modelInfo.dropout}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                  <dt className="text-secondary-500 truncate">Default Threshold</dt>
                  <dd className="font-mono text-secondary-900 truncate">{formatPercent(modelInfo.thr)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-secondary-900">Features</h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {FEATURE_NAMES.map((name) => (
                  <li key={name} className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-secondary-900 truncate">{name}</span>
                    <span className="text-secondary-500 truncate">{FEATURE_DESCRIPTIONS[name]}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}