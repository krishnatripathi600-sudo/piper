import { useState, useEffect, useMemo } from 'react'
import {
  Database,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { useMeters, useSampleWindows } from '@/hooks/useApi'
import { cn, formatDateTime, formatRelativeTime } from '@/lib/utils'
import type { SampleWindow } from '@/types/api'

export function DataExplorer() {
  const { data: metersData, isLoading: metersLoading, isRefreshing: metersRefreshing, refetch: refetchMeters } = useMeters()
  const [selectedMeter, setSelectedMeter] = useState<string | null>(null)
  const [samples, setSamples] = useState<SampleWindow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const [showLeaksOnly, setShowLeaksOnly] = useState(false)

  const meters = metersData?.meters ?? []

  const filteredMeters = useMemo(() => {
    return meters.filter((meter) => {
      const matchesSearch = meter.meter_id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [meters, searchQuery])

  const paginatedMeters = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredMeters.slice(start, start + pageSize)
  }, [filteredMeters, currentPage])

  const totalPages = Math.ceil(filteredMeters.length / pageSize)

  // Use the hook directly for samples
  const { data: sampleData, isLoading: sampleLoading, isRefreshing: sampleRefreshing, refetch: refetchSamples } = useSampleWindows(
    200,
    selectedMeter ? [selectedMeter] : undefined
  )

  useEffect(() => {
    if (sampleData?.windows) {
      setSamples(sampleData.windows)
    }
  }, [sampleData])

  const handleMeterClick = (meterId: string) => {
    setSelectedMeter(selectedMeter === meterId ? null : meterId)
    setCurrentPage(1)
    if (meterId !== selectedMeter) {
      refetchSamples()
    }
  }

  const isInitialLoading = metersLoading || (selectedMeter && sampleLoading)
  const isAnyRefreshing = metersRefreshing || sampleRefreshing

  const filteredSamples = useMemo(() => {
    return samples.filter((sample) => {
      if (showLeaksOnly && sample.y_true === 0) return false
      return true
    })
  }, [samples, showLeaksOnly])

  const sampleColumns = useMemo(() => [
    { key: 'meter_id', header: 'Meter ID', render: (row: SampleWindow) => (
      <span className="font-mono text-sm truncate">{row.meter_id}</span>
    )},
    { key: 'timestamp_end', header: 'Timestamp', render: (row: SampleWindow) => (
      <span className="font-mono text-sm truncate">{formatDateTime(row.timestamp_end)}</span>
    )},
    { key: 'hour', header: 'Hour', render: (row: SampleWindow) => (
      <Badge variant="neutral" size="sm">{row.hour}:00</Badge>
    )},
    { key: 'y_true', header: 'Actual', render: (row: SampleWindow) => (
      <Badge variant={row.y_true === 1 ? 'danger' : 'success'} dot>
        {row.y_true === 1 ? 'Leak' : 'Normal'}
      </Badge>
    )},
    { key: 'features', header: 'Features', render: (row: SampleWindow) => (
      <span className="text-secondary-500 text-sm">{row.features.length}×{row.features[0]?.length}</span>
    )},
    { key: 'actions', header: '', render: (row: SampleWindow) => (
      <Button variant="ghost" size="sm" onClick={() => handleSampleDetail(row)}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ], [])

  const [detailSample, setDetailSample] = useState<SampleWindow | null>(null)

  const handleSampleDetail = (sample: SampleWindow) => {
    setDetailSample(sample)
  }

  const closeDetail = () => {
    setDetailSample(null)
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
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-secondary-900 truncate">Data Explorer</h1>
          <p className="text-secondary-500 mt-1">Browse meter data and test windows from the frozen test set</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => refetchMeters()}>
            <Database className="h-4 w-4 mr-1" />
            Refresh Meters
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4 min-w-0">
        <Card className="lg:col-span-1 h-full flex flex-col">
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">Meters</h2>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-secondary-200">
              <Input
                placeholder="Search meters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
              {isInitialLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent mx-auto" />
                </div>
              ) : filteredMeters.length === 0 ? (
                <div className="p-8 text-center text-secondary-500">No meters found</div>
              ) : (
                <ul className="divide-y divide-secondary-100">
                  {paginatedMeters.map((meter) => (
                    <li
                      key={meter.meter_id}
                      onClick={() => handleMeterClick(meter.meter_id)}
                      className={cn(
                        'p-4 cursor-pointer transition-colors min-w-0',
                        selectedMeter === meter.meter_id
                          ? 'bg-primary-50 border-l-4 border-primary-500'
                          : 'hover:bg-secondary-50'
                      )}
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <span className="font-mono font-medium text-secondary-900 truncate">{meter.meter_id}</span>
                        <Badge variant="neutral" size="sm" className="flex-shrink-0">{meter.n_readings}</Badge>
                      </div>
                      <p className="text-xs text-secondary-500 mt-1 truncate">
                        {meter.date_range.start ? formatRelativeTime(meter.date_range.start) : 'No data'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {totalPages > 1 && (
              <div className="p-4 border-t border-secondary-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm text-secondary-500 truncate">
                  Page {currentPage} of {totalPages} ({filteredMeters.length} meters)
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 h-full flex flex-col min-w-0">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-secondary-900 truncate">
              {selectedMeter ? `Test Windows — ${selectedMeter}` : 'Select a meter to view test windows'}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-secondary-600">
                <input
                  type="checkbox"
                  checked={showLeaksOnly}
                  onChange={(e) => setShowLeaksOnly(e.target.checked)}
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                Leaks only
              </label>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            {selectedMeter ? (
              sampleLoading ? (
                <div className="flex items-center justify-center py-12 min-h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
                </div>
              ) : sampleRefreshing && filteredSamples.length > 0 ? (
                <>
                  <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium shadow-lg animate-pulse">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Refreshing samples...
                  </div>
                  <div className="mb-4 min-w-0">
                    <Table
                      columns={sampleColumns}
                      data={filteredSamples}
                      keyExtractor={(row) => `${row.meter_id}-${row.timestamp_end}`}
                      striped
                      hoverable
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-secondary-500 flex-wrap gap-2">
                    <span>Showing {filteredSamples.length} windows</span>
                  </div>
                </>
              ) : filteredSamples.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="h-12 w-12 mx-auto text-secondary-300" />
                  <p className="mt-2 text-secondary-500">No test windows available for this meter</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 min-w-0">
                    <Table
                      columns={sampleColumns}
                      data={filteredSamples}
                      keyExtractor={(row) => `${row.meter_id}-${row.timestamp_end}`}
                      striped
                      hoverable
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-secondary-500 flex-wrap gap-2">
                    <span>Showing {filteredSamples.length} windows</span>
                  </div>
                </>
              )
            ) : (
              <div className="text-center py-12 flex-1 flex items-center justify-center">
                <Database className="h-12 w-12 mx-auto text-secondary-300" />
                <p className="mt-2 text-secondary-500">Select a meter from the left panel to view its test windows</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {detailSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetail}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-secondary-200">
              <h2 className="text-lg font-semibold">Window Details</h2>
              <Button variant="ghost" size="sm" onClick={closeDetail}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              <div className="grid gap-4 sm:grid-cols-3 mb-4 min-w-0">
                <div className="p-3 rounded-lg bg-secondary-50 min-w-0">
                  <p className="text-sm text-secondary-500">Meter ID</p>
                  <p className="font-mono font-medium truncate">{detailSample.meter_id}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary-50 min-w-0">
                  <p className="text-sm text-secondary-500">Timestamp</p>
                  <p className="font-mono text-sm truncate">{formatDateTime(detailSample.timestamp_end)}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary-50 min-w-0">
                  <p className="text-sm text-secondary-500">Actual Label</p>
                  <Badge variant={detailSample.y_true === 1 ? 'danger' : 'success'} dot>
                    {detailSample.y_true === 1 ? 'Leak' : 'Normal'}
                  </Badge>
                </div>
              </div>

              <h3 className="font-medium text-secondary-900 mb-2">Features (Last 5 Steps)</h3>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-secondary-200">
                      <th className="px-3 py-2 text-left font-medium text-secondary-500">Step</th>
                      {['Hour', 'DayOfWeek', 'Month', 'roll6_mean', 'roll24_mean', 'roll6_std', 'roll24_std', 'rel_to_roll24', 'Delta_Volume'].map((f) => (
                        <th key={f} className="px-2 py-2 text-center font-medium text-secondary-500 uppercase tracking-wider min-w-[80px]">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailSample.features.slice(-5).map((row, idx) => (
                      <tr key={idx} className="border-b border-secondary-100">
                        <td className="px-3 py-2 font-mono text-secondary-500">t={detailSample.features.length - 5 + idx}</td>
                        {row.map((val, colIdx) => (
                          <td key={colIdx} className="px-2 py-2 text-center font-mono text-secondary-900">{val.toFixed(4)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}