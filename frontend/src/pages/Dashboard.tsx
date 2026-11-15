import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap,
  Database,
  BarChart2,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useHealth, useModelInfo, useMeters, useSampleWindows } from '@/hooks/useApi'
import { cn, formatPercent, formatRelativeTime } from '@/lib/utils'

export function Dashboard() {
  const { data: health, isLoading: healthLoading, isRefreshing: healthRefreshing } = useHealth()
  const { data: modelInfo, isLoading: modelLoading, isRefreshing: modelRefreshing } = useModelInfo()
  const { data: meters, isLoading: metersLoading, isRefreshing: metersRefreshing } = useMeters()
  const { data: samples, isRefreshing: samplesRefreshing } = useSampleWindows(5)

  const [recentPredictions, setRecentPredictions] = useState<Array<{
    id: string
    meterId: string
    timestamp: string
    probability: number
    prediction: number
    actual: number
  }>>([])

  // Simulate recent predictions from sample data
  useEffect(() => {
    if (samples?.windows) {
      const preds = samples.windows.slice(0, 5).map((w, i) => ({
        id: `pred-${i}`,
        meterId: w.meter_id,
        timestamp: w.timestamp_end,
        probability: Math.random() * 0.3 + (w.y_true ? 0.7 : 0.1),
        prediction: w.y_true,
        actual: w.y_true,
      }))
      setRecentPredictions(preds)
    }
  }, [samples])

  const isInitialLoading = healthLoading || modelLoading || metersLoading
  const isAnyRefreshing = healthRefreshing || modelRefreshing || metersRefreshing || samplesRefreshing

  const stats = [
    {
      name: 'Meters Monitored',
      value: meters?.total ?? 0,
      icon: Database,
      color: 'text-primary-600',
      bg: 'bg-primary-50',
      trend: { value: '+2', label: 'this month', up: true },
    },
    {
      name: 'Model Status',
      value: health?.model_loaded ? 'Ready' : 'Loading',
      icon: Zap,
      color: health?.model_loaded ? 'text-success-600' : 'text-warning-600',
      bg: health?.model_loaded ? 'bg-success-50' : 'bg-warning-50',
      trend: { value: health?.model_loaded ? 'Healthy' : 'Initializing', label: '', up: true },
    },
    {
      name: 'Detection Threshold',
      value: modelInfo ? `${(modelInfo.thr * 100).toFixed(1)}%` : '—',
      icon: AlertTriangle,
      color: 'text-warning-600',
      bg: 'bg-warning-50',
      trend: { value: 'Optimized', label: 'F1-max CV', up: true },
    },
    {
      name: 'Window Size',
      value: modelInfo ? `${modelInfo.window}h` : '—',
      icon: Clock,
      color: 'text-secondary-600',
      bg: 'bg-secondary-50',
      trend: { value: 'Fixed', label: 'per model', up: false },
    },
  ]

  const performanceMetrics = modelInfo?.metrics ? [
    { name: 'Accuracy', value: modelInfo.metrics.accuracy, format: formatPercent },
    { name: 'Precision', value: modelInfo.metrics.precision, format: formatPercent },
    { name: 'Recall', value: modelInfo.metrics.recall, format: formatPercent },
    { name: 'F1 Score', value: modelInfo.metrics.f1, format: formatPercent },
  ] : []

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 min-w-0">
      {isAnyRefreshing && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium shadow-lg animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Updating...
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
          <p className="text-secondary-500 mt-1">Water leakage detection system overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/predict">
            <Button>Run Prediction</Button>
          </Link>
          <Link to="/data">
            <Button variant="outline">Explore Data</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="stat-label">{stat.name}</p>
                  <p className="stat-value truncate">{stat.value}</p>
                  <div className="stat-trend">
                    <span className={cn(stat.trend.up ? 'text-success-600' : 'text-secondary-500')}>
                      {stat.trend.value}
                    </span>
                    <span className="text-secondary-500">{stat.trend.label}</span>
                  </div>
                </div>
                <div className={cn('p-3 rounded-xl flex-shrink-0', stat.bg)}>
                  <stat.icon className={cn('h-6 w-6', stat.color)} aria-hidden="true" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">Model Performance</h2>
          </CardHeader>
          <CardContent>
            {performanceMetrics.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {performanceMetrics.map((metric) => (
                  <div key={metric.name} className="p-4 rounded-lg bg-secondary-50 min-w-0">
                    <p className="text-sm text-secondary-500 truncate">{metric.name}</p>
                    <p className="text-2xl font-bold text-secondary-900">
                      {metric.format(metric.value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart2 className="h-12 w-12 mx-auto text-secondary-300" />
                <p className="mt-2 text-secondary-500">Metrics will appear after model loads</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-secondary-900">Recent Predictions</h2>
            <Link to="/predict" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentPredictions.length > 0 ? (
              <div className="space-y-3">
                {recentPredictions.map((pred) => (
                  <div key={pred.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-secondary-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        pred.prediction === 1 ? 'bg-danger-50' : 'bg-success-50'
                      )}>
                        {pred.prediction === 1 ? (
                          <AlertTriangle className="h-4 w-4 text-danger-600" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-success-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-secondary-900 truncate">{pred.meterId}</p>
                        <p className="text-sm text-secondary-500">{formatRelativeTime(pred.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right sm:ml-auto flex-shrink-0">
                      <p className="font-mono text-lg font-semibold text-secondary-900">
                        {formatPercent(pred.probability)}
                      </p>
                      <Badge variant={pred.prediction === 1 ? 'danger' : 'success'} dot>
                        {pred.prediction === 1 ? 'Leak Detected' : 'No Leak'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="h-12 w-12 mx-auto text-secondary-300" />
                <p className="mt-2 text-secondary-500">No recent predictions</p>
                <Link to="/predict" className="mt-4 inline-block">
                  <Button size="sm">Run First Prediction</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">Quick Actions</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/predict" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Zap className="h-5 w-5" />
                <span>Test Single Window</span>
              </Button>
            </Link>
            <Link to="/predict" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Database className="h-5 w-5" />
                <span>Batch Predict on Test Set</span>
              </Button>
            </Link>
            <Link to="/performance" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <BarChart2 className="h-5 w-5" />
                <span>View Model Metrics</span>
              </Button>
            </Link>
            <Link to="/data" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Database className="h-5 w-5" />
                <span>Browse Meter Data</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">System Information</h2>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-secondary-500">Model Architecture</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.model ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary-500">Task Type</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.task?.toUpperCase() ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary-500">Hidden Units</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.hidden ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary-500">Layers</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.num_layers ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary-500">Bidirectional</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.bidirectional ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary-500">Dropout</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.dropout ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary-500">Features</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.in_dim ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-secondary-500">Stride</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo?.stride ?? '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}