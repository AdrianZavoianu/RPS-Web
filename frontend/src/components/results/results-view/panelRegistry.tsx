/* eslint-disable react-refresh/only-export-components */
import { MultiSeriesProfileChart, PushoverCurveChart, PushoverMultiCurveChart } from '../../charts/ProfileChart'
import { BeamRotationsPlotPanel } from '../BeamRotationsPlotPanel'
import { BeamRotationsTable } from '../BeamRotationsTable'
import { ColumnRotationsPlotPanel } from '../ColumnRotationsPlotPanel'
import { JointResultsPlotPanel } from '../JointResultsPlotPanel'
import { MaxMinResultsDisplay } from '../MaxMinResultsDisplay'
import { ResultsTable } from '../ResultsTable'
import { ComparisonBeamRotationsPanel } from './panels/ComparisonBeamRotationsPanel'
import { ComparisonColumnRotationsPanel } from './panels/ComparisonColumnRotationsPanel'
import { ComparisonDataPanel } from './panels/ComparisonDataPanel'
import { ComparisonJointOverlayPanel } from './panels/ComparisonJointOverlayPanel'
import type { ResultsViewController } from './controller'
import type {
  BeamRotationsPlotData,
  BeamRotationsTableData,
  ColumnRotationsPlotData,
} from '../../../types'
import type { TreeSelectionType } from '../../projects/results-tree/types'

interface EmptyStateProps {
  title: string
  subtitle?: string
}

function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-text-muted mb-2">{title}</p>
        {subtitle ? <p className="text-text-muted text-xs">{subtitle}</p> : null}
      </div>
    </div>
  )
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-text-secondary">{message}</div>
    </div>
  )
}

function DatasetTableAndChart({ controller, dataset }: {
  controller: ResultsViewController
  dataset: ResultsViewController['resultsData']
}) {
  if (!dataset || !dataset.rows?.length) {
    return <EmptyState title="No data available" subtitle="Import results to see data here" />
  }

  return (
    <>
      <div className="overflow-auto">
        <ResultsTable
          dataset={dataset}
          selectedLoadCases={controller.tableState.selectedLoadCases}
          hoveredLoadCase={controller.tableState.hoveredLoadCase}
          hoveredRow={controller.tableState.hoveredRow}
          selectedRows={controller.tableState.selectedRows}
          onSelectionChange={controller.tableState.setSelectedLoadCases}
          onHoverChange={controller.tableState.setHoveredLoadCase}
          onRowHoverChange={controller.tableState.setHoveredRow}
          onRowSelectionChange={controller.tableState.setSelectedRows}
        />
      </div>

      <div className="flex-1 h-[90vh]">
        <MultiSeriesProfileChart
          dataset={dataset}
          selectedLoadCases={controller.tableState.selectedLoadCases}
          hoveredLoadCase={controller.tableState.hoveredLoadCase}
        />
      </div>
    </>
  )
}

type PanelRenderer = (controller: ResultsViewController) => JSX.Element

const panelRenderers: Record<TreeSelectionType, PanelRenderer> = {
  comparison_beam_rotations: (controller) => (
    <ComparisonBeamRotationsPanel
      projectSlug={controller.projectSlug}
      resultSetIds={controller.selection?.type === 'comparison_beam_rotations' ? controller.selection.resultSetIds : []}
    />
  ),

  comparison_column_rotations: (controller) => (
    <ComparisonColumnRotationsPanel
      projectSlug={controller.projectSlug}
      resultSetIds={controller.selection?.type === 'comparison_column_rotations' ? controller.selection.resultSetIds : []}
    />
  ),

  comparison_joint: (controller) => (
    <ComparisonJointOverlayPanel
      projectSlug={controller.projectSlug}
      resultSetIds={controller.selection?.type === 'comparison_joint' ? controller.selection.resultSetIds : []}
      resultType={controller.selection?.type === 'comparison_joint' ? controller.selection.resultType : ''}
    />
  ),

  comparison_global: (controller) => (
    <ComparisonDataPanel
      comparisonData={controller.comparisonData ?? null}
      comparisonChartData={controller.comparisonChartData}
      comparisonLoading={controller.comparisonLoading}
    />
  ),

  comparison_element: (controller) => (
    <ComparisonDataPanel
      comparisonData={controller.comparisonData ?? null}
      comparisonChartData={controller.comparisonChartData}
      comparisonLoading={controller.comparisonLoading}
    />
  ),

  maxmin: (controller) => {
    if (controller.maxMinLoading) return <LoadingState message="Loading max/min data..." />

    if (controller.selection?.type !== 'maxmin' || !controller.maxMinData?.rows?.length) {
      return <EmptyState title="No max/min data available" subtitle="Import results to see data here" />
    }

    return (
      <MaxMinResultsDisplay
        data={controller.maxMinData}
        resultType={controller.selection.resultType}
      />
    )
  },

  global_result: (controller) => {
    if (controller.resultsLoading) return <LoadingState message="Loading results..." />
    return <DatasetTableAndChart controller={controller} dataset={controller.resultsData} />
  },

  pushover_global: (controller) => {
    if (controller.resultsLoading) return <LoadingState message="Loading results..." />
    return <DatasetTableAndChart controller={controller} dataset={controller.resultsData} />
  },

  pushover_curve: (controller) => {
    if (controller.pushoverCurveLoading) return <LoadingState message="Loading curve data..." />

    if (!controller.pushoverCurveData || !controller.pushoverCurveTableDataset) {
      return <EmptyState title="No curve data available" />
    }

    return (
      <>
        <div className="overflow-auto">
          <ResultsTable dataset={controller.pushoverCurveTableDataset} showGradient={false} />
        </div>
        <div className="flex-1 h-[90vh]">
          <PushoverCurveChart
            points={controller.pushoverCurveData.points}
            caseName={controller.pushoverCurveData.case.name}
          />
        </div>
      </>
    )
  },

  pushover_all_curves: (controller) => {
    if (controller.pushoverAllCurvesLoading) return <LoadingState message="Loading all curves..." />

    if (!controller.pushoverAllCurves.length) {
      return <EmptyState title="No curve data available" />
    }

    return (
      <div className="flex-1 h-[90vh] w-full">
        <PushoverMultiCurveChart curves={controller.pushoverAllCurves} />
      </div>
    )
  },

  joint_plot: (controller) => {
    if (controller.jointResultsLoading) return <LoadingState message="Loading joint results..." />

    if (!controller.jointResultsData || !controller.jointResultsData.rows?.length) {
      return <EmptyState title="No joint data available" />
    }

    return <JointResultsPlotPanel dataset={controller.jointResultsData} />
  },

  joint: (controller) => {
    if (controller.jointResultsLoading) return <LoadingState message="Loading joint results..." />

    if (!controller.jointResultsData || !controller.jointResultsData.rows?.length) {
      return <EmptyState title="No joint data available" />
    }

    return (
      <div className="overflow-auto">
        <ResultsTable
          dataset={controller.jointResultsData}
          selectedLoadCases={controller.tableState.selectedLoadCases}
          hoveredLoadCase={controller.tableState.hoveredLoadCase}
          hoveredRow={controller.tableState.hoveredRow}
          selectedRows={controller.tableState.selectedRows}
          onSelectionChange={controller.tableState.setSelectedLoadCases}
          onHoverChange={controller.tableState.setHoveredLoadCase}
          onRowHoverChange={controller.tableState.setHoveredRow}
          onRowSelectionChange={controller.tableState.setSelectedRows}
        />
      </div>
    )
  },

  joint_table: (controller) => {
    if (controller.jointResultsLoading) return <LoadingState message="Loading joint results..." />

    if (!controller.jointResultsData || !controller.jointResultsData.rows?.length) {
      return <EmptyState title="No joint data available" />
    }

    return (
      <div className="overflow-auto">
        <ResultsTable
          dataset={controller.jointResultsData}
          selectedLoadCases={controller.tableState.selectedLoadCases}
          hoveredLoadCase={controller.tableState.hoveredLoadCase}
          hoveredRow={controller.tableState.hoveredRow}
          selectedRows={controller.tableState.selectedRows}
          onSelectionChange={controller.tableState.setSelectedLoadCases}
          onHoverChange={controller.tableState.setHoveredLoadCase}
          onRowHoverChange={controller.tableState.setHoveredRow}
          onRowSelectionChange={controller.tableState.setSelectedRows}
        />
      </div>
    )
  },

  beam_rotations_plot: (controller) => {
    if (controller.beamRotationsPlotLoading) {
      return <LoadingState message="Loading beam rotation plot data..." />
    }

    if (!controller.beamRotationsPlotData) {
      return <EmptyState title="No beam rotation data available" />
    }

    return <BeamRotationsPlotPanel data={controller.beamRotationsPlotData as BeamRotationsPlotData} />
  },

  beam_rotations_table: (controller) => {
    if (controller.beamRotationsTableLoading) {
      return <LoadingState message="Loading beam rotation table..." />
    }

    if (!controller.beamRotationsTableData) {
      return <EmptyState title="No beam rotation data available" />
    }

    return <BeamRotationsTable data={controller.beamRotationsTableData as BeamRotationsTableData} />
  },

  column_rotations_plot: (controller) => {
    if (controller.columnRotationsPlotLoading) {
      return <LoadingState message="Loading column rotation plot data..." />
    }

    if (!controller.columnRotationsPlotData) {
      return <EmptyState title="No column rotation data available" />
    }

    return (
      <ColumnRotationsPlotPanel
        data={controller.columnRotationsPlotData as ColumnRotationsPlotData}
      />
    )
  },

  quad_rotations_plot: (controller) => {
    if (controller.quadRotationsPlotLoading) {
      return <LoadingState message="Loading quad rotation plot data..." />
    }

    if (!controller.quadRotationsPlotData) {
      return <EmptyState title="No quad rotation data available" />
    }

    return (
      <ColumnRotationsPlotPanel
        data={controller.quadRotationsPlotData as ColumnRotationsPlotData}
      />
    )
  },

  element: (controller) => {
    const isLoading =
      controller.elementsLoading ||
      (controller.selectedElementId !== null && controller.elementResultsLoading)

    if (isLoading) {
      return <LoadingState message="Loading element results..." />
    }

    if (!controller.elements.length) {
      return (
        <EmptyState
          title="No elements found for this result type"
          subtitle="Import results to see element data here"
        />
      )
    }

    if (!controller.elementResultsData || !controller.elementResultsData.rows?.length) {
      return (
        <EmptyState
          title="No data available for this element"
          subtitle="Try another element or result set"
        />
      )
    }

    return <DatasetTableAndChart controller={controller} dataset={controller.elementResultsData} />
  },

  time_series: () => (
    <EmptyState
      title="This tree selection is not available in this panel yet"
      subtitle="Use the matching section from the project navigation"
    />
  ),
}

export function renderResultsSelectionPanel(controller: ResultsViewController) {
  const selection = controller.selection

  if (!selection) {
    return (
      <EmptyState
        title="Select a result from the tree browser"
        subtitle="Or import data to get started"
      />
    )
  }

  const renderer = panelRenderers[selection.type]

  if (!renderer) {
    return (
      <EmptyState
        title="This tree selection is not available in this panel yet"
        subtitle="Use the matching section from the project navigation"
      />
    )
  }

  return renderer(controller)
}
