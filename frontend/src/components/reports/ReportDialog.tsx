/**
 * Report Dialog component
 * Allows users to configure and generate PDF reports
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { useResultSets } from '../../hooks/useResults'
import { useReportPreview, useGenerateReport } from '../../hooks/useReports'
import type { ReportSection, AvailableSection } from '../../api/reports'
import { getApiErrorMessage } from '../../types/errors'

interface ReportDialogProps {
  projectSlug: string
  onClose: () => void
}

export function ReportDialog({ projectSlug, onClose }: ReportDialogProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [includeTable, setIncludeTable] = useState(true)
  const [includeChart, setIncludeChart] = useState(true)

  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: preview, isLoading: previewLoading } = useReportPreview(
    projectSlug,
    selectedResultSetId
  )
  const generateReport = useGenerateReport(projectSlug)

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  // Select all sections by default when preview loads
  useEffect(() => {
    if (preview?.available_sections) {
      const allKeys = new Set(
        preview.available_sections.map((s) => `${s.result_type}_${s.direction}`)
      )
      setSelectedSections(allKeys)
    }
  }, [preview])

  const toggleSection = (section: AvailableSection) => {
    const key = `${section.result_type}_${section.direction}`
    const newSelected = new Set(selectedSections)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedSections(newSelected)
  }

  const selectAll = () => {
    if (preview?.available_sections) {
      setSelectedSections(
        new Set(preview.available_sections.map((s) => `${s.result_type}_${s.direction}`))
      )
    }
  }

  const deselectAll = () => {
    setSelectedSections(new Set())
  }

  const handleGenerate = async () => {
    if (!selectedResultSetId || selectedSections.size === 0) return

    const sections: ReportSection[] = Array.from(selectedSections).map((key) => {
      const [result_type, direction] = key.split('_')
      return {
        result_type,
        direction,
        include_table: includeTable,
        include_chart: includeChart,
      }
    })

    try {
      await generateReport.mutateAsync({
        result_set_id: selectedResultSetId,
        sections,
      })
      onClose()
    } catch (error) {
      console.error(getApiErrorMessage(error, 'Failed to generate report'))
    }
  }

  return (
    <div className="report-dialog fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-bg-secondary border border-border-default rounded-lg shadow-xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">Generate PDF Report</h2>
          <p className="text-sm text-text-secondary mt-1">
            Select result set and sections to include
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Result Set Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Result Set
            </label>
            {resultSetsLoading ? (
              <div className="text-sm text-text-muted">Loading...</div>
            ) : resultSets?.length ? (
              <select
                value={selectedResultSetId || ''}
                onChange={(e) => setSelectedResultSetId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
              >
                {resultSets.map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name} ({rs.analysis_type})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-text-muted">No result sets available</div>
            )}
          </div>

          {/* Section Selection */}
          {preview && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">
                  Report Sections
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs text-accent-secondary hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-xs text-accent-secondary hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {previewLoading ? (
                <div className="text-sm text-text-muted">Loading sections...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-bg-primary rounded border border-border-default">
                  {preview.available_sections.map((section) => {
                    const key = `${section.result_type}_${section.direction}`
                    const isSelected = selectedSections.has(key)
                    return (
                      <label
                        key={key}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-accent-selected text-accent-secondary'
                            : 'hover:bg-bg-hover text-text-primary'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSection(section)}
                          className="rounded border-border-default"
                        />
                        <span className="text-sm">{section.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Include in Report
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTable}
                  onChange={(e) => setIncludeTable(e.target.checked)}
                  className="rounded border-border-default"
                />
                <span className="text-sm text-text-primary">Data Tables</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeChart}
                  onChange={(e) => setIncludeChart(e.target.checked)}
                  className="rounded border-border-default"
                />
                <span className="text-sm text-text-primary">Building Profile Charts</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-default flex items-center justify-between">
          <div className="text-sm text-text-muted">
            {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!selectedResultSetId || selectedSections.size === 0 || generateReport.isPending}
              className={clsx(
                'px-4 py-2 rounded text-sm font-medium transition-colors',
                generateReport.isPending
                  ? 'bg-accent-primary/50 text-white/50 cursor-wait'
                  : selectedResultSetId && selectedSections.size > 0
                  ? 'bg-accent-primary text-white hover:bg-accent-hover'
                  : 'bg-bg-primary text-text-muted cursor-not-allowed'
              )}
            >
              {generateReport.isPending ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
        </div>

        {/* Error message */}
        {generateReport.isError && (
          <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20">
            <p className="text-sm text-red-400">
              {getApiErrorMessage(generateReport.error, 'Failed to generate report')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
