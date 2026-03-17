import type { MaxMinDataset } from '../../../types'
import { DirectionPlot } from './DirectionPlot'

export interface PlotsTabProps {
  data: MaxMinDataset
  directions: string[]
  loadCases: string[]
  resultType: string
  unit: string
  decimals: number | null
}

export function PlotsTab({
  data, directions, loadCases, resultType, unit, decimals,
}: PlotsTabProps) {
  return (
    <div className="maxmin-plots flex-1">
      <div className="flex gap-4 h-[calc(90vh-3rem)]">
        {directions.map((dir) => (
          <DirectionPlot
            key={dir}
            direction={dir}
            data={data}
            loadCases={loadCases}
            resultType={resultType}
            unit={unit}
            decimals={decimals}
          />
        ))}
      </div>
    </div>
  )
}
