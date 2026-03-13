import type { ComparisonDataset, ProfileChartData } from '../../../../types'
import { buildComparisonTableDataset } from '../../../../features/results/mappers/comparisonPanelMappers'
import { ProfileChart } from '../../../charts/ProfileChart'
import { ComparisonTable } from '../../ComparisonTable'

interface ComparisonDataPanelProps {
  comparisonData: ComparisonDataset | null
  comparisonChartData: ProfileChartData | null
  comparisonLoading: boolean
}

export function ComparisonDataPanel({
  comparisonData,
  comparisonChartData,
  comparisonLoading,
}: ComparisonDataPanelProps) {
  const comparisonTableDataset = buildComparisonTableDataset(comparisonData)

  if (comparisonLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading comparison data...</div>
      </div>
    )
  }

  if (!comparisonData || !comparisonData.rows.length || !comparisonTableDataset) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-2">No comparison data available</p>
          <p className="text-text-muted text-xs">Check that the selected result sets contain this data</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="comparison-table-panel overflow-auto">
        <ComparisonTable
          dataset={comparisonTableDataset}
        />
      </div>
      {comparisonChartData && (
        <div className="comparison-chart-panel flex-1 h-[90vh]">
          <ProfileChart data={comparisonChartData} />
        </div>
      )}
    </>
  )
}
