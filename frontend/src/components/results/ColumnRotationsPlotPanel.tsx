import type { ColumnRotationsPlotData } from '../../types'
import { RotationPlotPanel } from './RotationPlotPanel'

interface ColumnRotationsPlotPanelProps {
  data: ColumnRotationsPlotData
}

export function ColumnRotationsPlotPanel({ data }: ColumnRotationsPlotPanelProps) {
  return (
    <RotationPlotPanel
      maxPoints={data.max_points}
      minPoints={data.min_points}
      stories={data.stories}
      histogramBins={data.histogram_bins}
      xLabel={data.meta.x_label}
      emptyMessage="No column rotation data available"
      className="column-rotations-plot"
      directions={data.directions}
      showDirectionInHover
      separateMaxMin
      maxSeed={64}
      minSeed={65}
    />
  )
}
