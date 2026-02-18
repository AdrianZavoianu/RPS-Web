import { ResultsTreeBrowser } from '../projects/ResultsTreeBrowser'
import { ResultsViewHeader } from './results-view/ResultsViewHeader'
import { useResultsViewController } from './results-view/controller'
import { renderResultsSelectionPanel } from './results-view/panelRegistry'

interface ResultsViewProps {
  projectSlug: string
}

export function ResultsView({ projectSlug }: ResultsViewProps) {
  const controller = useResultsViewController(projectSlug)

  return (
    <div className="results-view h-full flex bg-bg-primary">
      <div className="w-[240px] min-w-[240px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <ResultsTreeBrowser
            projectSlug={projectSlug}
            onSelect={controller.handleTreeSelect}
            currentSelection={controller.selection}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden pl-4">
        {controller.hasRenderableSelection ? (
          <>
            <ResultsViewHeader
              title={controller.title}
              isComparisonSelection={controller.isComparisonDataSelection}
              comparisonMetric={controller.comparisonMetric}
              onComparisonMetricChange={controller.setComparisonMetric}
              selectionType={controller.selection?.type}
              selectedElementId={controller.selectedElementId}
              onSelectedElementIdChange={controller.setSelectedElementId}
              elements={controller.elements}
              elementDirectionOptions={controller.elementDirectionOptions}
              selectedElementDirection={controller.selectedElementDirection}
              onSelectedElementDirectionChange={controller.setSelectedElementDirection}
            />

            <div className="flex-1 flex items-start overflow-hidden">
              {renderResultsSelectionPanel(controller)}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            {renderResultsSelectionPanel(controller)}
          </div>
        )}
      </div>
    </div>
  )
}
