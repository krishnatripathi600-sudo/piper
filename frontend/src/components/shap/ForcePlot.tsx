import { FEATURE_LABELS, FEATURE_UNITS } from '@/pages/Replay'

interface ForcePlotProps {
  shapValues: number[]
  featureNames: string[]
  baseValue: number
  prediction: number
  featureValues: number[]
}

export function ForcePlot({ shapValues, featureNames, baseValue, prediction, featureValues }: ForcePlotProps) {
  // Create items for visualization
  const items = featureNames.map((name, i) => ({
    name,
    label: FEATURE_LABELS[name] || name,
    unit: FEATURE_UNITS[name] || '',
    shap: shapValues[i],
    value: featureValues[i],
    color: shapValues[i] < 0 ? '#22c55e' : '#ef4444'
  }))

  // Sort by absolute SHAP value for better visualization
  const sortedItems = [...items].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap))

  const maxAbsShap = Math.max(...items.map(d => Math.abs(d.shap)), 0.01)
  const barHeight = (shap: number) => Math.min(Math.abs(shap) / maxAbsShap * 60, 60)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-secondary-500">Base Value (E[f(x)]):</span>
        <span className="font-mono bg-secondary-100 px-2 py-1 rounded">{baseValue.toFixed(4)}</span>
        <span className="text-secondary-500 mx-1">→</span>
        <span className="font-mono bg-primary-50 px-2 py-1 rounded border border-primary-200 text-primary-900">
          Prediction: {prediction.toFixed(4)}
        </span>
      </div>

      <div className="flex items-end gap-2 overflow-x-auto pb-4">
        {/* Base value */}
        <div className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
          <div className="w-full h-16 bg-secondary-100 rounded-t-lg flex items-end justify-center px-2 pb-1">
            <span className="text-xs font-medium text-secondary-600">{baseValue.toFixed(3)}</span>
          </div>
          <div className="text-center text-xs mt-1">
            <div className="font-medium text-secondary-700">Base</div>
            <div className="text-secondary-500">E[f(x)]</div>
          </div>
        </div>

        {/* Feature contributions */}
        {sortedItems.map((item, i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
            <div 
              className="w-full rounded-t-lg flex items-end justify-center px-2 pb-1 transition-all duration-300"
              style={{ 
                background: item.color,
                height: `${barHeight(item.shap)}px`,
                minHeight: '4px'
              }}
              title={`${item.label}: ${item.shap > 0 ? '+' : ''}${item.shap.toFixed(4)}`}
            >
              <span className="text-[10px] font-medium text-white mb-1">
                {item.shap > 0 ? '+' : ''}{item.shap.toFixed(3)}
              </span>
            </div>
            <div className="text-center text-xs mt-1 max-w-[90px]">
              <div className="font-medium text-secondary-900 truncate" title={item.label}>{item.label}</div>
              <div className="text-secondary-500">{item.value.toFixed(2)} {item.unit}</div>
            </div>
          </div>
        ))}

        {/* Prediction */}
        <div className="flex-shrink-0 flex flex-col items-center min-w-[80px]">
          <div className="w-full h-16 bg-primary-50 rounded-t-lg flex items-end justify-center px-2 pb-1 border border-primary-200">
            <span className="text-xs font-medium text-primary-900">{prediction.toFixed(3)}</span>
          </div>
          <div className="text-center text-xs mt-1">
            <div className="font-medium text-primary-700">Prediction</div>
            <div className="text-primary-600">f(x)</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-secondary-600 pt-2 border-t">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[#ef4444]" /> Pushes toward LEAK
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[#22c55e]" /> Pushes toward NORMAL
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-secondary-200 border" /> Base value
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary-50 border border-primary-200" /> Final prediction
        </span>
      </div>
    </div>
  )
}