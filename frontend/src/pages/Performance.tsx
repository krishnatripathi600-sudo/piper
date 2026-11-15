import { useMemo } from 'react'
import {
  BarChart2,
  Download,
  RefreshCw,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Cell as PieCell,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useModelInfo } from '@/hooks/useApi'
import { cn, formatPercent } from '@/lib/utils'

const METRIC_COLORS = {
  accuracy: '#0ea5e9',
  precision: '#22c55e',
  recall: '#f59e0b',
  f1: '#8b5cf6',
  f2: '#ec4899',
  ap: '#06b6d4',
}

export function Performance() {
  const { data: modelInfo, isLoading, isRefreshing, refetch } = useModelInfo()
  const metrics = modelInfo?.metrics

  interface MetricCard {
    key: string
    label: string
    value: number
    description: string
  }

  const metricCards = useMemo<MetricCard[]>(() => {
    if (!metrics) return []
    const cards: MetricCard[] = [
      { key: 'accuracy', label: 'Accuracy', value: metrics.accuracy, description: 'Overall correctness' },
      { key: 'precision', label: 'Precision', value: metrics.precision, description: 'Of predicted leaks, how many are real' },
      { key: 'recall', label: 'Recall', value: metrics.recall, description: 'Of actual leaks, how many detected' },
      { key: 'f1', label: 'F1 Score', value: metrics.f1, description: 'Harmonic mean of precision & recall' },
    ]
    if (metrics.f2) cards.push({ key: 'f2', label: 'F2 Score', value: metrics.f2, description: 'Recall-weighted F-beta' })
    if (metrics.ap) cards.push({ key: 'ap', label: 'PR-AUC', value: metrics.ap, description: 'Area under Precision-Recall curve' })
    return cards
  }, [metrics])

  const confusionMatrix = useMemo(() => {
    if (!metrics?.cm) return null
    return {
      tn: metrics.cm[0]?.[0] ?? 0,
      fp: metrics.cm[0]?.[1] ?? 0,
      fn: metrics.cm[1]?.[0] ?? 0,
      tp: metrics.cm[1]?.[1] ?? 0,
    }
  }, [metrics])

  const cmData = useMemo(() => {
    if (!confusionMatrix) return []
    return [
      { name: 'True Negative', value: confusionMatrix.tn, fill: '#22c55e' },
      { name: 'False Positive', value: confusionMatrix.fp, fill: '#f59e0b' },
      { name: 'False Negative', value: confusionMatrix.fn, fill: '#ef4444' },
      { name: 'True Positive', value: confusionMatrix.tp, fill: '#0ea5e9' },
    ]
  }, [confusionMatrix])

  if (isLoading || !modelInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-secondary-900 truncate">Model Performance</h1>
            <p className="text-secondary-500 mt-1">Evaluation metrics from cross-validated test set</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Reload
          </Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <BarChart2 className="h-12 w-12 mx-auto text-secondary-300" />
            <h3 className="mt-4 text-lg font-medium text-secondary-900">No Metrics Available</h3>
            <p className="mt-2 text-secondary-500 max-w-md mx-auto">
              Model metrics are not loaded. Ensure the model artifacts include a metrics file.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 min-w-0">
      {isRefreshing && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium shadow-lg animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Updating...
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-secondary-900 truncate">Model Performance</h1>
          <p className="text-secondary-500 mt-1">Evaluation metrics from cross-validated test set</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info" dot>
            Threshold: {formatPercent(metrics.thr)}
          </Badge>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Reload
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricCards.map((metric) => (
          <Card key={metric.key} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between min-w-0">
                <div className="min-w-0">
                  <p className="stat-label truncate">{metric.label}</p>
                  <p className="stat-value text-3xl truncate">{formatPercent(metric.value)}</p>
                  <p className="text-xs text-secondary-500 mt-1 truncate">{metric.description}</p>
                </div>
                <div className={cn('p-3 rounded-xl flex-shrink-0', `bg-${metric.key}-50`)}>
                  <div className="h-6 w-6 rounded" style={{ backgroundColor: METRIC_COLORS[metric.key as keyof typeof METRIC_COLORS] }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">Confusion Matrix</h2>
          </CardHeader>
          <CardContent>
            {confusionMatrix ? (
              <div className="space-y-4 min-w-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="border-b border-secondary-200">
                        <th className="px-4 py-2 text-left text-secondary-500"></th>
                        <th className="px-4 py-2 text-center font-medium">Predicted: No Leak</th>
                        <th className="px-4 py-2 text-center font-medium">Predicted: Leak</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-secondary-100">
                        <td className="px-4 py-2 font-medium">Actual: No Leak</td>
                        <td className="px-4 py-2 text-center">
                          <div className={cn('inline-flex items-center justify-center px-4 py-2 rounded-lg font-mono text-lg', 'bg-success-50 text-success-700')}>
                            {confusionMatrix.tn}
                          </div>
                          <p className="text-xs text-secondary-500 mt-1 text-center">True Negative</p>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className={cn('inline-flex items-center justify-center px-4 py-2 rounded-lg font-mono text-lg', 'bg-warning-50 text-warning-700')}>
                            {confusionMatrix.fp}
                          </div>
                          <p className="text-xs text-secondary-500 mt-1 text-center">False Positive</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium">Actual: Leak</td>
                        <td className="px-4 py-2 text-center">
                          <div className={cn('inline-flex items-center justify-center px-4 py-2 rounded-lg font-mono text-lg', 'bg-danger-50 text-danger-700')}>
                            {confusionMatrix.fn}
                          </div>
                          <p className="text-xs text-secondary-500 mt-1 text-center">False Negative</p>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className={cn('inline-flex items-center justify-center px-4 py-2 rounded-lg font-mono text-lg', 'bg-primary-50 text-primary-700')}>
                            {confusionMatrix.tp}
                          </div>
                          <p className="text-xs text-secondary-500 mt-1 text-center">True Positive</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-secondary-200">
                  <div className="text-center p-3 rounded-lg bg-secondary-50 min-w-0">
                    <p className="text-2xl font-bold text-secondary-900 truncate">
                      {confusionMatrix.tp + confusionMatrix.tn + confusionMatrix.fp + confusionMatrix.fn}
                    </p>
                    <p className="text-xs text-secondary-500">Total Samples</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary-50 min-w-0">
                    <p className="text-2xl font-bold text-success-600 truncate">
                      {formatPercent((confusionMatrix.tp + confusionMatrix.tn) / (confusionMatrix.tp + confusionMatrix.tn + confusionMatrix.fp + confusionMatrix.fn))}
                    </p>
                    <p className="text-xs text-secondary-500">Accuracy</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary-50 min-w-0">
                    <p className="text-2xl font-bold text-primary-600 truncate">
                      {confusionMatrix.tp > 0 ? formatPercent(confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fn)) : '0%'}
                    </p>
                    <p className="text-xs text-secondary-500">Recall (Sensitivity)</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-secondary-500 text-center py-8">Confusion matrix not available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">Prediction Distribution</h2>
          </CardHeader>
          <CardContent>
            {cmData.length > 0 ? (
              <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cmData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      labelLine={false}
                    >
                      {cmData.map((entry, index) => (
                        <PieCell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value.toString(), 'samples']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-secondary-500 text-center py-8">Distribution data not available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-secondary-900">Metric Comparison</h2>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricCards} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis type="number" domain={[0, 1]} tickFormatter={formatPercent} />
                  <YAxis type="category" dataKey="label" width={120} />
                  <Tooltip
                    formatter={(value: number) => [formatPercent(value), '']}
                    labelFormatter={(label: string) => label}
                  />
                  <Bar
                    dataKey="value"
                    name="Score"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={30}
                  >
                    {metricCards.map((metric, index) => (
                      <Cell key={`bar-${index}`} fill={METRIC_COLORS[metric.key as keyof typeof METRIC_COLORS] ?? '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">Model Configuration</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm min-w-0">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                <dt className="text-secondary-500 truncate">Model</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo.model}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                <dt className="text-secondary-500 truncate">Task</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo.task?.toUpperCase()}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                <dt className="text-secondary-500 truncate">Window Size</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo.window} hours</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                <dt className="text-secondary-500 truncate">Stride</dt>
                <dd className="font-mono text-secondary-900 truncate">{modelInfo.stride}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                <dt className="text-secondary-500 truncate">Input Dimensions</dt>
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
                <dt className="text-secondary-500 truncate">Decision Threshold</dt>
                <dd className="font-mono text-secondary-900 truncate">{formatPercent(metrics.thr)}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                <dt className="text-secondary-500 truncate">Threshold Source</dt>
                <dd className="font-mono text-secondary-900 truncate">F1-optimal CV (median)</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-secondary-900">Features Used</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
            {modelInfo.feature_cols.map((feature) => (
              <Badge key={feature} variant="neutral" className="text-xs font-mono px-3 py-1.5 truncate">
                {feature}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}