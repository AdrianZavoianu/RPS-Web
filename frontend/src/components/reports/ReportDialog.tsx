/**
 * Report Dialog component
 * Split-panel layout: left controls + right A4 live preview.
 * Fetches section data with 300ms debounce and client-side cache.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import clsx from 'clsx'
import { useResultSets } from '../../hooks/useResults'
import { useReportPreview, useGenerateReport, useReportSectionData } from '../../hooks/useReports'
import type { ReportSection, AvailableSection, SectionData } from '../../api/reports'
import { getApiErrorMessage } from '../../types/errors'
import { ReportPreviewArea } from './ReportPreviewArea'

interface ReportDialogProps {
  projectSlug: string
  projectName: string
  onClose: () => void
}

type CategoryGroup = {
  category: string
  label: string
  subGroups: SubGroup[]
}

type SubGroup = {
  label: string
  sections: AvailableSection[]
}

const RESULT_TYPE_LABELS: Record<string, string> = {
  Drifts: 'Story Drifts',
  Accelerations: 'Story Accelerations',
  Forces: 'Story Forces',
  Displacements: 'Story Displacements',
}

function sectionKey(s: AvailableSection): string {
  return `${s.category}_${s.result_type}_${s.direction}`
}

function normalizeReportCategory(rawCategory?: string): string {
  const normalized = (rawCategory || "Global").trim().toLowerCase()
  if (normalized === "global" || normalized === "globals") return "Global"
  if (normalized === "element" || normalized === "elements") return "Element"
  if (normalized === "joint" || normalized === "joints") return "Joint"
  return rawCategory || "Global"
}

function buildCategoryGroups(sections: AvailableSection[]): CategoryGroup[] {
  const categoryOrder = ['Global', 'Element', 'Joint']
  const categoryLabels: Record<string, string> = {
    Global: 'Global Results',
    Element: 'Element Results',
    Joint: 'Joint Results',
  }

  const grouped: Record<string, AvailableSection[]> = {}
  for (const s of sections) {
    const cat = normalizeReportCategory(s.category)
    ;(grouped[cat] ??= []).push(s)
  }

  const orderedCategories = [
    ...categoryOrder,
    ...Object.keys(grouped).filter((cat) => !categoryOrder.includes(cat)),
  ]

  const result: CategoryGroup[] = []
  for (const cat of orderedCategories) {
    const items = grouped[cat]
    if (!items?.length) continue

    if (cat === 'Global') {
      const byType: Record<string, AvailableSection[]> = {}
      for (const s of items) {
        ;(byType[s.result_type] ??= []).push(s)
      }
      const subGroups: SubGroup[] = Object.entries(byType).map(([rt, secs]) => ({
        label: RESULT_TYPE_LABELS[rt] || rt,
        sections: secs,
      }))
      result.push({ category: cat, label: categoryLabels[cat] || cat, subGroups })
    } else {
      result.push({
        category: cat,
        label: categoryLabels[cat] || cat,
        subGroups: [{ label: '', sections: items }],
      })
    }
  }

  return result
}

export function ReportDialog({ projectSlug, projectName, onClose }: ReportDialogProps) {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [includeTable, setIncludeTable] = useState(true)
  const [includeChart, setIncludeChart] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Preview section data
  const [previewSections, setPreviewSections] = useState<SectionData[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const sectionCacheRef = useRef<Map<string, SectionData>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestPreviewRequestRef = useRef(0)

  const { data: resultSets, isLoading: resultSetsLoading } = useResultSets(projectSlug)
  const { data: preview, isLoading: previewMetaLoading } = useReportPreview(
    projectSlug,
    selectedResultSetId
  )
  const generateReport = useGenerateReport(projectSlug)
  const { mutateAsync: fetchSectionData } = useReportSectionData(projectSlug)

  const categoryGroups = useMemo(
    () => (preview?.available_sections ? buildCategoryGroups(preview.available_sections) : []),
    [preview]
  )

  // Auto-select first result set
  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  // Select all sections by default when preview loads
  useEffect(() => {
    if (preview?.available_sections) {
      setSelectedSections(new Set(preview.available_sections.map(sectionKey)))
    }
  }, [preview])

  // Clear cache when result set changes
  useEffect(() => {
    sectionCacheRef.current.clear()
    setPreviewSections([])
  }, [selectedResultSetId])

  // Build the current section configs from selections
  const buildSectionConfigs = useCallback((): ReportSection[] => {
    if (!preview?.available_sections) return []
    const sectionMap = new Map<string, AvailableSection>()
    for (const s of preview.available_sections) {
      sectionMap.set(sectionKey(s), s)
    }
    return Array.from(selectedSections)
      .map((key) => {
        const s = sectionMap.get(key)
        if (!s) return null
        return {
          result_type: s.result_type,
          direction: s.direction,
          category: s.category,
          include_table: includeTable,
          include_chart: includeChart,
        }
      })
      .filter(Boolean) as ReportSection[]
  }, [preview, selectedSections, includeTable, includeChart])

  // Debounced fetch for preview
  const fetchPreviewData = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      if (!selectedResultSetId || selectedSections.size === 0) {
        setPreviewSections([])
        return
      }

      const configs = buildSectionConfigs()
      if (configs.length === 0) {
        setPreviewSections([])
        return
      }

      // Check which sections we need from the server
      const cache = sectionCacheRef.current
      const cachedResults: SectionData[] = []
      const uncachedConfigs: ReportSection[] = []

      for (const cfg of configs) {
        const cacheKey = `${cfg.category}_${cfg.result_type}_${cfg.direction}_t${cfg.include_table}_c${cfg.include_chart}`
        const cached = cache.get(cacheKey)
        if (cached) {
          cachedResults.push(cached)
        } else {
          uncachedConfigs.push(cfg)
        }
      }

      if (uncachedConfigs.length === 0) {
        // All cached — reorder to match config order
        const ordered = reorderFromConfigs(configs, cache)
        setPreviewSections(ordered)
        setPreviewLoading(false)
        return
      }

      const requestId = latestPreviewRequestRef.current + 1
      latestPreviewRequestRef.current = requestId
      setPreviewLoading(true)
      try {
        const response = await fetchSectionData({
          result_set_id: selectedResultSetId,
          project_name: projectName,
          sections: uncachedConfigs,
        })

        // Ignore stale responses from earlier requests.
        if (latestPreviewRequestRef.current !== requestId) {
          return
        }

        // Store in cache
        for (const section of response.sections) {
          const key = buildCacheKeyFromSection(section, includeTable, includeChart)
          cache.set(key, section)
        }

        // Build full ordered list
        const ordered = reorderFromConfigs(configs, cache)
        setPreviewSections(ordered)
      } catch {
        // Keep whatever we had
      } finally {
        if (latestPreviewRequestRef.current === requestId) {
          setPreviewLoading(false)
        }
      }
    }, 300)
  }, [selectedResultSetId, selectedSections, includeTable, includeChart, buildSectionConfigs, fetchSectionData])

  // Trigger preview fetch on selection changes
  useEffect(() => {
    fetchPreviewData()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchPreviewData])

  // --- Selection helpers ---

  const toggleSection = (section: AvailableSection) => {
    const key = sectionKey(section)
    const next = new Set(selectedSections)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedSections(next)
  }

  const allKeysForCategory = (group: CategoryGroup): string[] =>
    group.subGroups.flatMap((sg) => sg.sections.map(sectionKey))

  const allKeysForSubGroup = (sg: SubGroup): string[] => sg.sections.map(sectionKey)

  const checkState = (keys: string[]): 'all' | 'none' | 'some' => {
    const checked = keys.filter((k) => selectedSections.has(k)).length
    if (checked === 0) return 'none'
    if (checked === keys.length) return 'all'
    return 'some'
  }

  const toggleKeys = (keys: string[]) => {
    const state = checkState(keys)
    const next = new Set(selectedSections)
    if (state === 'all') {
      keys.forEach((k) => next.delete(k))
    } else {
      keys.forEach((k) => next.add(k))
    }
    setSelectedSections(next)
  }

  const toggleCategoryCollapse = (cat: string) => {
    const next = new Set(collapsedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setCollapsedCategories(next)
  }

  const selectAll = () => {
    if (preview?.available_sections) {
      setSelectedSections(new Set(preview.available_sections.map(sectionKey)))
    }
  }

  const deselectAll = () => setSelectedSections(new Set())

  const handleGenerate = async () => {
    if (!selectedResultSetId || selectedSections.size === 0) return

    const sections = buildSectionConfigs()
    if (sections.length === 0) return

    try {
      await generateReport.mutateAsync({
        result_set_id: selectedResultSetId,
        project_name: projectName,
        sections,
      })
      onClose()
    } catch (error) {
      console.error(getApiErrorMessage(error, 'Failed to generate report'))
    }
  }

  const resultSetName = preview?.result_set?.name || ''

  return (
    <div className="report-dialog fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog — widened */}
      <div className="relative bg-bg-secondary border border-border-default rounded-lg shadow-xl flex flex-col"
        style={{ width: '85vw', height: '85vh', maxWidth: '1600px' }}
      >
        {/* Header */}
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

        {/* Split panel body */}
        <div className="flex flex-1 min-h-0">
          {/* Left Panel — Controls */}
          <div className="w-[30%] min-w-[280px] border-r border-border-default flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Result Set Selection */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Result Set
                </label>
                {resultSetsLoading ? (
                  <div className="text-sm text-text-muted">Loading...</div>
                ) : resultSets?.length ? (
                  <select
                    value={selectedResultSetId || ''}
                    onChange={(e) => setSelectedResultSetId(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary"
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

              {/* Section Tree */}
              {preview && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-text-secondary">Sections</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-xs text-accent-secondary hover:underline"
                      >
                        All
                      </button>
                      <span className="text-text-muted text-xs">|</span>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="text-xs text-accent-secondary hover:underline"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {previewMetaLoading ? (
                    <div className="text-sm text-text-muted">Loading sections...</div>
                  ) : (
                    <div className="report-section-tree max-h-[50vh] overflow-y-auto p-2 bg-bg-primary rounded border border-border-default space-y-1">
                      {categoryGroups.map((group) => {
                        const catKeys = allKeysForCategory(group)
                        const catState = checkState(catKeys)
                        const isCollapsed = collapsedCategories.has(group.category)

                        return (
                          <div key={group.category}>
                            <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-hover">
                              <button
                                type="button"
                                onClick={() => toggleCategoryCollapse(group.category)}
                                className="text-text-muted w-4 text-xs flex-shrink-0"
                              >
                                {isCollapsed ? '\u25B6' : '\u25BC'}
                              </button>
                              <TriStateCheckbox
                                state={catState}
                                onChange={() => toggleKeys(catKeys)}
                              />
                              <span className="text-sm font-semibold text-text-primary">
                                {group.label}
                              </span>
                              <span className="text-xs text-text-muted ml-auto">
                                {catKeys.filter((k) => selectedSections.has(k)).length}/
                                {catKeys.length}
                              </span>
                            </div>

                            {!isCollapsed && (
                              <div className="ml-6">
                                {group.subGroups.map((sg) => {
                                  const sgKeys = allKeysForSubGroup(sg)
                                  const hasSubLabel = sg.label && sg.sections.length > 1

                                  if (hasSubLabel) {
                                    const sgState = checkState(sgKeys)
                                    return (
                                      <div key={sg.label} className="mb-0.5">
                                        <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-bg-hover">
                                          <TriStateCheckbox
                                            state={sgState}
                                            onChange={() => toggleKeys(sgKeys)}
                                          />
                                          <span className="text-sm font-medium text-text-secondary">
                                            {sg.label}
                                          </span>
                                        </div>
                                        <div className="ml-6">
                                          {sg.sections.map((section) => (
                                            <SectionLeaf
                                              key={sectionKey(section)}
                                              section={section}
                                              checked={selectedSections.has(sectionKey(section))}
                                              onChange={() => toggleSection(section)}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  }

                                  return sg.sections.map((section) => (
                                    <SectionLeaf
                                      key={sectionKey(section)}
                                      section={section}
                                      checked={selectedSections.has(sectionKey(section))}
                                      onChange={() => toggleSection(section)}
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

              {/* Options */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Include
                </label>
                <div className="flex gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTable}
                      onChange={(e) => {
                        setIncludeTable(e.target.checked)
                        sectionCacheRef.current.clear()
                      }}
                      className="rounded border-border-default"
                    />
                    <span className="text-sm text-text-primary">Tables</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeChart}
                      onChange={(e) => {
                        setIncludeChart(e.target.checked)
                        sectionCacheRef.current.clear()
                      }}
                      className="rounded border-border-default"
                    />
                    <span className="text-sm text-text-primary">Charts</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-4 py-3 border-t border-border-default flex flex-col gap-2 flex-shrink-0">
              <div className="text-xs text-text-muted">
                {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
              </div>
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
                  onClick={handleGenerate}
                  disabled={
                    !selectedResultSetId ||
                    selectedSections.size === 0 ||
                    generateReport.isPending
                  }
                  className={clsx(
                    'px-4 py-1.5 rounded text-sm font-medium transition-colors flex-1',
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

              {generateReport.isError && (
                <p className="text-xs text-red-400">
                  {getApiErrorMessage(generateReport.error, 'Failed to generate report')}
                </p>
              )}
            </div>
          </div>

          {/* Right Panel — Preview */}
          <div className="flex-1 min-w-0">
            <ReportPreviewArea
              sections={previewSections}
              projectName={projectName}
              resultSetName={resultSetName}
              isLoading={previewLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Helpers ---

function buildCacheKeyFromSection(
  section: SectionData,
  includeTable: boolean,
  includeChart: boolean
): string {
  return `${section.category}_${section.result_type}_${section.direction}_t${includeTable}_c${includeChart}`
}

function reorderFromConfigs(
  configs: ReportSection[],
  cache: Map<string, SectionData>
): SectionData[] {
  const result: SectionData[] = []
  for (const cfg of configs) {
    const key = `${cfg.category}_${cfg.result_type}_${cfg.direction}_t${cfg.include_table}_c${cfg.include_chart}`
    const cached = cache.get(key)
    if (cached) result.push(cached)
  }
  return result
}

// --- Sub-components ---

function TriStateCheckbox({
  state,
  onChange,
}: {
  state: 'all' | 'none' | 'some'
  onChange: () => void
}) {
  return (
    <input
      type="checkbox"
      checked={state === 'all'}
      ref={(el) => {
        if (el) el.indeterminate = state === 'some'
      }}
      onChange={onChange}
      className="rounded border-border-default flex-shrink-0"
    />
  )
}

function SectionLeaf({
  section,
  checked,
  onChange,
}: {
  section: AvailableSection
  checked: boolean
  onChange: () => void
}) {
  const displayLabel =
    section.category === 'Global' && section.direction ? section.direction : section.label

  return (
    <label
      className={clsx(
        'flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors',
        checked
          ? 'bg-accent-selected text-accent-secondary'
          : 'hover:bg-bg-hover text-text-primary'
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
