import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { FEATURE_LABELS, FEATURE_UNITS } from '@/pages/Replay'

interface WaterfallPlotProps {
  shapValues: number[]
  featureNames: string[]
  baseValue: number
  prediction: number
  featureValues: number[]
}

export function WaterfallPlot({ shapValues, featureNames, baseValue, prediction, featureValues }: WaterfallPlotProps) {
  // Create data points for each feature
  const data = featureNames.map((name, i) => ({
    name: FEATURE_LABELS[name] || name,
    feature: name,
    shap: shapValues[i],
    value: featureValues[i],
    unit: FEATURE_UNITS[name] || '',
    color: shapValues[i] < 0 ? '#22c55e' : '#ef4444',
    absShap: Math.abs(shapValues[i])
  }))

  // Sort by absolute SHAP value (most important first)
  const sortedData = [...data].sort((a, b) => b.absShap - a.absShap)

  // Calculate cumulative values for waterfall
  let cumulative = baseValue
  const waterfallData = sortedData.map((d, i) => {
    const start = cumulative
    cumulative += d.shap
    return {
      ...d,
      start,
      end: cumulative,
      isLast: i === sortedData.length - 1
    }
  })

  const maxAbs = Math.max(
    ...waterfallData.map(d => Math.max(Math.abs(d.start), Math.abs(d.end), Math.abs(d.shap))),
    0.01
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-secondary-500">Base:</span>
        <span className="font-mono bg-secondary-100 px-2 py-1 rounded">{baseValue.toFixed(4)}</span>
        <span className="text-secondary-500 mx-1">→</span>
        <span className="font-mono bg-primary-50 px-2 py-1 rounded border border-primary-200 text-primary-900">
          {prediction.toFixed(4)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={waterfallData} layout="vertical" margin={{ left: 140, right: 20, top: 10, bottom: 20 }}>
          <XAxis 
            domain={[-maxAbs * 1.2, maxAbs * 1.2]} 
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={140} 
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              const item = waterfallData.find(d => d.name === name)
              if (!item) return [value.toFixed(4), name]
              return [
                `${item.shap > 0 ? '+' : ''}${item.shap.toFixed(4)}`,
                `${item.name} (${item.value.toFixed(2)} ${item.unit})`
              ]
            }}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
          />
          
          {/* Base value bar */}
          <Bar
            dataKey="start"
            fill="#e5e7eb"
            radius={[4, 0, 0, 4]}
            minPointSize={0}
          />
          
          {/* SHAP contribution bars */}
          <Bar
            dataKey="shap"
            fill="#ef4444"
            radius={[0, 4, 4, 0]}
            minPointSize={0}
          >
            {waterfallData.map((d, i) => (
              <Cell key={i} fill={d.shap < 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="flex items-center justify-between text-xs text-secondary-600 pt-2 border-t">
        <span>Features sorted by |SHAP| impact</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#ef4444]" /> Increases leak probability
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#22c55e]" /> Decreases leak probability
          </span>
        </div>
      </div>
    </div>
  )
}