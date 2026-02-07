import { useCallback, useState } from 'react'
import { useGlobalResults, useMaxMinData } from '../../hooks/useResults'
import { MultiSeriesProfileChart } from '../charts/ProfileChart'
import { ResultsTreeBrowser, type TreeSelection } from '../projects/ResultsTreeBrowser'
import type { GlobalResultType } from '../../types'
import { ResultsTable } from './ResultsTable'
import { MaxMinResultsDisplay } from './MaxMinResultsDisplay'
import { getResultTypeUnit } from '../../utils/resultConfig'

interface ResultsViewProps {
  projectSlug: string
}

export function ResultsView({ projectSlug }: ResultsViewProps) {
  const [selection, setSelection] = useState<TreeSelection | null>(null)
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [hoveredLoadCase, setHoveredLoadCase] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const handleTreeSelect = useCallback((newSelection: TreeSelection) => {
    setSelection(newSelection)
    setSelectedLoadCases(new Set())
    setHoveredLoadCase(null)
    setSelectedRows(new Set())
    setHoveredRow(null)
  }, [])

  const { data: resultsData, isLoading: resultsLoading } = useGlobalResults(
    projectSlug,
    selection?.resultSetId && selection.type === 'global_result'
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType as GlobalResultType,
          direction: selection.direction,
        }
      : null
  )

  const { data: maxMinData, isLoading: maxMinLoading } = useMaxMinData(
    projectSlug,
    selection?.resultSetId && selection.type === 'maxmin'
      ? {
          result_set_id: selection.resultSetId,
          result_type: selection.resultType,
        }
      : null
  )

  const getDisplayTitle = () => {
    if (!selection) return ''
    const { resultType, direction } = selection
    const unit = getResultTypeUnit(resultType)
    if (direction === 'MaxMin') {
      return `▸ Story ${resultType}${unit ? ` (${unit})` : ''} - Max/Min`
    }
    return `▸ Story ${resultType}${unit ? ` (${unit})` : ''} - ${direction} Direction`
  }

  return (
    <div className="results-view h-full flex bg-bg-primary">
      <div className="w-[200px] min-w-[200px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <ResultsTreeBrowser
            projectSlug={projectSlug}
            onSelect={handleTreeSelect}
            currentSelection={selection}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden pl-4">
        {selection?.resultSetId ? (
          <>
            <div className="flex items-center py-2">
              <span className="text-lg font-medium text-text-primary">{getDisplayTitle()}</span>
            </div>

            <div className="flex-1 flex items-start overflow-hidden">
              {selection.type === 'maxmin' ? (
                maxMinLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading max/min data...</div>
                  </div>
                ) : maxMinData && maxMinData.rows?.length > 0 ? (
                  <MaxMinResultsDisplay
                    data={maxMinData}
                    resultType={selection.resultType}
                    selectedLoadCases={selectedLoadCases}
                    hoveredLoadCase={hoveredLoadCase}
                    onSelectionChange={setSelectedLoadCases}
                    onHoverChange={setHoveredLoadCase}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-text-muted mb-2">No max/min data available</p>
                      <p className="text-text-muted text-xs">Import results to see data here</p>
                    </div>
                  </div>
                )
              ) : (
                resultsLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-text-secondary">Loading results...</div>
                  </div>
                ) : resultsData && resultsData.rows?.length > 0 ? (
                  <>
                    <div className="overflow-auto">
                      <ResultsTable
                        dataset={resultsData}
                        selectedLoadCases={selectedLoadCases}
                        hoveredLoadCase={hoveredLoadCase}
                        hoveredRow={hoveredRow}
                        selectedRows={selectedRows}
                        onSelectionChange={setSelectedLoadCases}
                        onHoverChange={setHoveredLoadCase}
                        onRowHoverChange={setHoveredRow}
                        onRowSelectionChange={setSelectedRows}
                      />
                    </div>

                    <div className="flex-1 h-[90vh]">
                      <MultiSeriesProfileChart
                        dataset={resultsData}
                        selectedLoadCases={selectedLoadCases}
                        hoveredLoadCase={hoveredLoadCase}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-text-muted mb-2">No data available</p>
                      <p className="text-text-muted text-xs">
                        Import results to see data here
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-secondary mb-4">Select a result from the tree browser</p>
              <p className="text-text-muted text-sm">Or import data to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
