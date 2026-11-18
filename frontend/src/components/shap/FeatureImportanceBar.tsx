import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { FEATURE_LABELS, FEATURE_UNITS } from '@/pages/Replay'

interface FeatureImportanceBarProps {
  aggregatedImportance: Record<string, number>
}

export function FeatureImportanceBar({ aggregatedImportance }: FeatureImportanceBarProps) {
  const data = Object.entries(aggregatedImportance)
    .map(([feature, importance]) => ({
      feature: FEATURE_LABELS[feature] || feature,
      featureKey: feature,
      importance,
      unit: FEATURE_UNITS[feature] || ''
    }))
    .sort((a, b) => b.importance - a.importance)

  const maxImportance = Math.max(...data.map(d => d.importance), 0.01)

  return (
    <div className="space-y-3">
      <div className="text-sm text-secondary-600">
        Mean |SHAP| across 48 timesteps (higher = more important globally)
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 140, right: 20, top: 10, bottom: 20 }}>
          <XAxis 
            domain={[0, maxImportance * 1.15]} 
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(4)}
          />
          <YAxis 
            type="category" 
            dataKey="feature" 
            width={140} 
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              const item = data.find(d => d.feature === name)
              if (!item) return [value.toFixed(4), 'Mean |SHAP|']
              return [
                value.toFixed(4),
                `${item.feature} (${item.featureKey})`
              ]
            }}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
          />
          <Bar 
            dataKey="importance" 
            fill="#0ea5e9" 
            radius={[4, 0, 0, 4]}
            minPointSize={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={`hsl(${200 - i * 15}, 70%, 50%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Top 3 features summary */}
      <div className="grid gap-2 sm:grid-cols-3">
        {data.slice(0, 3).map((item, i) => (
          <div key={item.feature} className="p-3 rounded-lg bg-secondary-50 border border-secondary-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary-500">#{i + 1}</span>
              <span className="font-bold text-primary-600">{item.importance.toFixed(4)}</span>
            </div>
            <div className="font-medium text-secondary-900 text-sm mt-1">{item.feature}</div>
            <div className="text-xs text-secondary-500">Mean |SHAP|</div>
          </div>
        ))}
      </div>
    </div>
  )
}