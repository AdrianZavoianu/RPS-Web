import clsx from 'clsx'
import type { Element } from '../../../types'
import { COMPARISON_METRICS, type ComparisonMetric } from '../comparisonUtils'

interface ResultsViewHeaderProps {
  title: string
  isComparisonSelection: boolean
  comparisonMetric: ComparisonMetric
  onComparisonMetricChange: (metric: ComparisonMetric) => void
  selectionType: string | undefined
  selectedElementId: number | null
  onSelectedElementIdChange: (elementId: number | null) => void
  elements: Element[]
  elementDirectionOptions: string[]
  selectedElementDirection: string | null
  onSelectedElementDirectionChange: (direction: string) => void
}

export function ResultsViewHeader({
  title,
  isComparisonSelection,
  comparisonMetric,
  onComparisonMetricChange,
  selectionType,
  selectedElementId,
  onSelectedElementIdChange,
  elements,
  elementDirectionOptions,
  selectedElementDirection,
  onSelectedElementDirectionChange,
}: ResultsViewHeaderProps) {
  return (
    <div className="flex items-center justify-between py-2 gap-3">
      <span className="text-lg font-medium text-text-primary">{title}</span>

      {isComparisonSelection && (
        <div className="comparison-metric-toggle flex items-center gap-1">
          {COMPARISON_METRICS.map((metric) => (
            <button
              key={metric}
              type="button"
              onClick={() => onComparisonMetricChange(metric)}
              className={clsx(
                'px-3 py-1 rounded text-sm transition-colors',
                comparisonMetric === metric
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
              )}
            >
              {metric}
            </button>
          ))}
        </div>
      )}

      {selectionType === 'element' && (
        <div className="flex items-center gap-2">
          <select
            value={selectedElementId || ''}
            onChange={(event) => onSelectedElementIdChange(Number(event.target.value))}
            disabled={!elements.length}
            className="px-2 py-1.5 bg-bg-secondary border border-border-default rounded text-sm text-text-primary min-w-[180px]"
          >
            {!elements.length && <option value="">No elements</option>}
            {elements.map((element) => (
              <option key={element.id} value={element.id}>
                {element.name}
              </option>
            ))}
          </select>
          {elementDirectionOptions.map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => onSelectedElementDirectionChange(direction)}
              className={
                selectedElementDirection === direction
                  ? 'px-3 py-1 rounded text-sm bg-accent-primary text-white'
                  : 'px-3 py-1 rounded text-sm bg-bg-secondary text-text-secondary hover:bg-bg-hover'
              }
            >
              {direction}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
