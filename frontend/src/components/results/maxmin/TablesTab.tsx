import type { MaxMinDataset } from '../../../types'
import { DirectionTables } from './DirectionTables'

export interface TablesTabProps {
  data: MaxMinDataset
  directions: string[]
  loadCases: string[]
  resultType: string
  unit: string
  fmt: (v: number | null | undefined) => string
}

export function TablesTab({ data, directions, loadCases, resultType, unit, fmt }: TablesTabProps) {
  return (
    <div className="maxmin-tables-tab flex flex-col gap-6 flex-1 overflow-auto pt-4">
      {directions.map((dir) => (
        <DirectionTables
          key={dir}
          direction={dir}
          data={data}
          loadCases={loadCases}
          resultType={resultType}
          unit={unit}
          fmt={fmt}
        />
      ))}
    </div>
  )
}
