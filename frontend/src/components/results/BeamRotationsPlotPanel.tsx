import type { BeamRotationsPlotData } from '../../types'
import { RotationPlotPanel } from './RotationPlotPanel'

interface BeamRotationsPlotPanelProps {
  data: BeamRotationsPlotData
}

export function BeamRotationsPlotPanel({ data }: BeamRotationsPlotPanelProps) {
  return (
    <RotationPlotPanel
      maxPoints={data.max_points}
      minPoints={data.min_points}
      stories={data.stories}
      histogramBins={data.histogram_bins}
      xLabel={data.meta.x_label}
      emptyMessage="No beam rotation data available"
      className="beam-rotations-plot"
      maxSeed={42}
      minSeed={43}
    />
  )
}
