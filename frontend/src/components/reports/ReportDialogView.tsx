import clsx from 'clsx'
import type { AvailableSection } from '../../api/reports'
import { ReportPreviewArea } from './ReportPreviewArea'
import type { UseReportDialogStateResult } from './useReportDialogState'

interface ReportDialogViewProps {
  onClose: () => void
  projectName: string
  state: UseReportDialogStateResult
}

export function ReportDialogView({ onClose, projectName, state }: ReportDialogViewProps) {
  return (
    <div className="report-dialog fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative bg-bg-secondary border border-border-default rounded-lg shadow-xl flex flex-col"
        style={{ width: '85vw', height: '85vh', maxWidth: '1600px' }}
      >
        <div className="px-6 py-3 border-b border-border-default flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">PDF Report</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Configure sections and preview before generating
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-[30%] min-w-[280px] border-r border-border-default flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Result Set
                </label>
                {state.resultSetsLoading ? (
                  <div className="text-sm text-text-muted">Loading...</div>
                ) : state.resultSets?.length ? (
                  <select
                    value={state.selectedResultSetId || ''}
                    onChange={(e) => state.handleResultSetChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
                  >
                    {state.resultSets.map((resultSet) => (
                      <option key={resultSet.id} value={resultSet.id}>
                        {resultSet.name} ({resultSet.analysis_type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-text-muted">No result sets available</div>
                )}
              </div>

              {state.preview && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-text-secondary">Sections</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={state.handleSelectAll}
                        className="text-xs text-accent-secondary hover:underline"
                      >
                        All
                      </button>
                      <span className="text-text-muted text-xs">|</span>
                      <button
                        type="button"
                        onClick={state.handleDeselectAll}
                        className="text-xs text-accent-secondary hover:underline"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {state.previewMetaLoading ? (
                    <div className="text-sm text-text-muted">Loading sections...</div>
                  ) : (
                    <div className="report-section-tree max-h-[50vh] overflow-y-auto p-2 bg-bg-primary rounded border border-border-default space-y-1">
                      {state.categoryGroups.map((group) => {
                        const categoryKeys = state.getCategoryKeys(group)
                        const categoryState = state.getSelectionState(categoryKeys)
                        const isCollapsed = state.collapsedCategories.has(group.category)

                        return (
                          <div key={group.category}>
                            <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-hover">
                              <button
                                type="button"
                                onClick={() => state.handleToggleCategoryCollapse(group.category)}
                                className="text-text-muted w-4 text-xs flex-shrink-0"
                              >
                                {isCollapsed ? '\u25B6' : '\u25BC'}
                              </button>
                              <TriStateCheckbox
                                state={categoryState}
                                onChange={() => state.handleToggleKeys(categoryKeys)}
                              />
                              <span className="text-sm font-semibold text-text-primary">
                                {group.label}
                              </span>
                              <span className="text-xs text-text-muted ml-auto">
                                {categoryKeys.filter((key) => state.selectedSections.has(key)).length}/
                                {categoryKeys.length}
                              </span>
                            </div>

                            {!isCollapsed && (
                              <div className="ml-6">
                                {group.subGroups.map((subGroup) => {
                                  const subGroupKeys = state.getSubGroupKeys(subGroup)
                                  const hasSubGroupLabel =
                                    subGroup.label && subGroup.sections.length > 1

                                  if (hasSubGroupLabel) {
                                    const subGroupState = state.getSelectionState(subGroupKeys)

                                    return (
                                      <div key={subGroup.label} className="mb-0.5">
                                        <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-bg-hover">
                                          <TriStateCheckbox
                                            state={subGroupState}
                                            onChange={() => state.handleToggleKeys(subGroupKeys)}
                                          />
                                          <span className="text-sm font-medium text-text-secondary">
                                            {subGroup.label}
                                          </span>
                                        </div>
                                        <div className="ml-6">
                                          {subGroup.sections.map((section) => (
                                            <SectionLeaf
                                              key={`${section.category}_${section.result_type}_${section.direction}`}
                                              section={section}
                                              checked={state.isSectionSelected(section)}
                                              onChange={() => state.handleToggleSection(section)}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  }

                                  return subGroup.sections.map((section) => (
                                    <SectionLeaf
                                      key={`${section.category}_${section.result_type}_${section.direction}`}
                                      section={section}
                                      checked={state.isSectionSelected(section)}
                                      onChange={() => state.handleToggleSection(section)}
                                    />
                                  ))
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Include</label>
                <div className="flex gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.includeTable}
                      onChange={(e) => state.handleToggleIncludeTable(e.target.checked)}
                      className="rounded border-border-default"
                    />
                    <span className="text-sm text-text-primary">Tables</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.includeChart}
                      onChange={(e) => state.handleToggleIncludeChart(e.target.checked)}
                      className="rounded border-border-default"
                    />
                    <span className="text-sm text-text-primary">Charts</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border-default flex flex-col gap-2 flex-shrink-0">
              <div className="text-xs text-text-muted">
                {state.selectedSections.size} section{state.selectedSections.size !== 1 ? 's' : ''}{' '}
                selected
              </div>
              {state.previewError && <p className="text-xs text-red-400">{state.previewError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={state.handleGenerate}
                  disabled={!state.canGenerate || state.isGenerating}
                  className={clsx(
                    'px-4 py-1.5 rounded text-sm font-medium transition-colors flex-1',
                    state.isGenerating
                      ? 'bg-accent-primary/50 text-white/50 cursor-wait'
                      : state.canGenerate
                        ? 'bg-accent-primary text-white hover:bg-accent-hover'
                        : 'bg-bg-primary text-text-muted cursor-not-allowed'
                  )}
                >
                  {state.isGenerating ? 'Generating...' : 'Generate PDF'}
                </button>
              </div>

              {state.generateErrorMessage && (
                <p className="text-xs text-red-400">{state.generateErrorMessage}</p>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <ReportPreviewArea
              sections={state.previewSections}
              projectName={projectName}
              resultSetName={state.resultSetName}
              isLoading={state.previewLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TriStateCheckbox({
  onChange,
  state,
}: {
  onChange: () => void
  state: 'all' | 'none' | 'some'
}) {
  return (
    <input
      type="checkbox"
      checked={state === 'all'}
      ref={(element) => {
        if (element) {
          element.indeterminate = state === 'some'
        }
      }}
      onChange={onChange}
      className="rounded border-border-default flex-shrink-0"
    />
  )
}

function SectionLeaf({
  checked,
  onChange,
  section,
}: {
  checked: boolean
  onChange: () => void
  section: AvailableSection
}) {
  const displayLabel =
    section.category === 'Global' && section.direction ? section.direction : section.label

  return (
    <label
      className={clsx(
        'flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors',
        checked ? 'bg-accent-selected text-accent-secondary' : 'hover:bg-bg-hover text-text-primary'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-border-default flex-shrink-0"
      />
      <span className="text-sm">{displayLabel}</span>
    </label>
  )
}
