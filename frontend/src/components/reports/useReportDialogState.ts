import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AvailableSection, ReportSection, SectionData } from '../../api/reports'
import { useGenerateReport, useReportPreview, useReportSectionData } from '../../hooks/useReports'
import { useResultSets } from '../../hooks/useResults'
import { getApiErrorMessage } from '../../types/errors'

export type ReportCategoryGroup = {
  category: string
  label: string
  subGroups: ReportSubGroup[]
}

export type ReportSubGroup = {
  label: string
  sections: AvailableSection[]
}

type SelectionState = 'all' | 'none' | 'some'

interface UseReportDialogStateParams {
  onClose: () => void
  projectName: string
  projectSlug: string
}

export interface UseReportDialogStateResult {
  canGenerate: boolean
  categoryGroups: ReportCategoryGroup[]
  collapsedCategories: Set<string>
  generateErrorMessage: string | null
  includeChart: boolean
  includeTable: boolean
  isGenerating: boolean
  preview: ReturnType<typeof useReportPreview>['data']
  previewError: string | null
  previewLoading: boolean
  previewMetaLoading: boolean
  previewSections: SectionData[]
  resultSetName: string
  resultSets: ReturnType<typeof useResultSets>['data']
  resultSetsLoading: boolean
  selectedResultSetId: number | null
  selectedSections: Set<string>
  getCategoryKeys: (group: ReportCategoryGroup) => string[]
  getSelectionState: (keys: string[]) => SelectionState
  getSubGroupKeys: (subGroup: ReportSubGroup) => string[]
  handleDeselectAll: () => void
  handleGenerate: () => void
  handleResultSetChange: (value: string) => void
  handleSelectAll: () => void
  handleToggleCategoryCollapse: (category: string) => void
  handleToggleIncludeChart: (checked: boolean) => void
  handleToggleIncludeTable: (checked: boolean) => void
  handleToggleKeys: (keys: string[]) => void
  handleToggleSection: (section: AvailableSection) => void
  isSectionSelected: (section: AvailableSection) => boolean
}

const RESULT_TYPE_LABELS: Record<string, string> = {
  Drifts: 'Story Drifts',
  Accelerations: 'Story Accelerations',
  Displacements: 'Story Displacements',
  Forces: 'Story Forces',
}

function sectionKey(section: AvailableSection): string {
  return `${section.category}_${section.result_type}_${section.direction}`
}

function normalizeReportCategory(rawCategory?: string): string {
  const normalized = (rawCategory || 'Global').trim().toLowerCase()
  if (normalized === 'global' || normalized === 'globals') {
    return 'Global'
  }
  if (normalized === 'element' || normalized === 'elements') {
    return 'Element'
  }
  if (normalized === 'joint' || normalized === 'joints') {
    return 'Joint'
  }
  return rawCategory || 'Global'
}

function buildCategoryGroups(sections: AvailableSection[]): ReportCategoryGroup[] {
  const categoryOrder = ['Global', 'Element', 'Joint']
  const categoryLabels: Record<string, string> = {
    Global: 'Global Results',
    Element: 'Element Results',
    Joint: 'Joint Results',
  }

  const groupedSections: Record<string, AvailableSection[]> = {}
  for (const section of sections) {
    const category = normalizeReportCategory(section.category)
    ;(groupedSections[category] ??= []).push(section)
  }

  const orderedCategories = [
    ...categoryOrder,
    ...Object.keys(groupedSections).filter((category) => !categoryOrder.includes(category)),
  ]

  const categoryGroups: ReportCategoryGroup[] = []
  for (const category of orderedCategories) {
    const categorySections = groupedSections[category]
    if (!categorySections?.length) {
      continue
    }

    if (category === 'Global') {
      const byType: Record<string, AvailableSection[]> = {}
      for (const section of categorySections) {
        ;(byType[section.result_type] ??= []).push(section)
      }

      const subGroups: ReportSubGroup[] = Object.entries(byType).map(([resultType, sections]) => ({
        label: RESULT_TYPE_LABELS[resultType] || resultType,
        sections,
      }))

      categoryGroups.push({
        category,
        label: categoryLabels[category] || category,
        subGroups,
      })
      continue
    }

    categoryGroups.push({
      category,
      label: categoryLabels[category] || category,
      subGroups: [{ label: '', sections: categorySections }],
    })
  }

  return categoryGroups
}

function buildCacheKey(
  category: string,
  resultType: string,
  direction: string | null,
  includeTable: boolean,
  includeChart: boolean
): string {
  return `${category}_${resultType}_${direction}_t${includeTable}_c${includeChart}`
}

function buildCacheKeyFromSection(
  section: SectionData,
  includeTable: boolean,
  includeChart: boolean
): string {
  return buildCacheKey(
    section.category,
    section.result_type,
    section.direction,
    includeTable,
    includeChart
  )
}

function buildCacheKeyFromConfig(section: ReportSection): string {
  return buildCacheKey(
    section.category || 'Global',
    section.result_type,
    section.direction,
    Boolean(section.include_table),
    Boolean(section.include_chart)
  )
}

function reorderFromConfigs(
  configs: ReportSection[],
  cache: Map<string, SectionData>
): SectionData[] {
  const orderedSections: SectionData[] = []
  for (const config of configs) {
    const cachedSection = cache.get(buildCacheKeyFromConfig(config))
    if (cachedSection) {
      orderedSections.push(cachedSection)
    }
  }
  return orderedSections
}

export function useReportDialogState({
  onClose,
  projectName,
  projectSlug,
}: UseReportDialogStateParams): UseReportDialogStateResult {
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [includeTable, setIncludeTable] = useState(true)
  const [includeChart, setIncludeChart] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const [previewSections, setPreviewSections] = useState<SectionData[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

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

  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  useEffect(() => {
    if (preview?.available_sections) {
      setSelectedSections(new Set(preview.available_sections.map(sectionKey)))
    }
  }, [preview])

  useEffect(() => {
    sectionCacheRef.current.clear()
    setPreviewSections([])
    setPreviewError(null)
  }, [selectedResultSetId])

  const buildSectionConfigs = useCallback((): ReportSection[] => {
    if (!preview?.available_sections) {
      return []
    }

    const sectionMap = new Map<string, AvailableSection>()
    for (const section of preview.available_sections) {
      sectionMap.set(sectionKey(section), section)
    }

    return Array.from(selectedSections)
      .map((key) => {
        const section = sectionMap.get(key)
        if (!section) {
          return null
        }

        return {
          category: section.category,
          direction: section.direction,
          include_chart: includeChart,
          include_table: includeTable,
          result_type: section.result_type,
        }
      })
      .filter(Boolean) as ReportSection[]
  }, [includeChart, includeTable, preview, selectedSections])

  const fetchPreviewData = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      if (!selectedResultSetId || selectedSections.size === 0) {
        setPreviewSections([])
        setPreviewError(null)
        setPreviewLoading(false)
        return
      }

      const configs = buildSectionConfigs()
      if (configs.length === 0) {
        setPreviewSections([])
        setPreviewError(null)
        setPreviewLoading(false)
        return
      }

      const cache = sectionCacheRef.current
      const uncachedConfigs: ReportSection[] = []

      for (const config of configs) {
        const cacheKey = buildCacheKeyFromConfig(config)
        if (!cache.has(cacheKey)) {
          uncachedConfigs.push(config)
        }
      }

      if (uncachedConfigs.length === 0) {
        setPreviewSections(reorderFromConfigs(configs, cache))
        setPreviewError(null)
        setPreviewLoading(false)
        return
      }

      const requestId = latestPreviewRequestRef.current + 1
      latestPreviewRequestRef.current = requestId
      setPreviewLoading(true)
      setPreviewError(null)

      try {
        const response = await fetchSectionData({
          result_set_id: selectedResultSetId,
          project_name: projectName,
          sections: uncachedConfigs,
        })

        if (latestPreviewRequestRef.current !== requestId) {
          return
        }

        for (const section of response.sections) {
          const key = buildCacheKeyFromSection(section, includeTable, includeChart)
          cache.set(key, section)
        }

        setPreviewSections(reorderFromConfigs(configs, cache))
      } catch (error) {
        setPreviewError(getApiErrorMessage(error, 'Failed to refresh report preview'))
      } finally {
        if (latestPreviewRequestRef.current === requestId) {
          setPreviewLoading(false)
        }
      }
    }, 300)
  }, [
    buildSectionConfigs,
    fetchSectionData,
    includeChart,
    includeTable,
    projectName,
    selectedResultSetId,
    selectedSections,
  ])

  useEffect(() => {
    fetchPreviewData()
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [fetchPreviewData])

  const getCategoryKeys = (group: ReportCategoryGroup): string[] =>
    group.subGroups.flatMap((subGroup) => subGroup.sections.map(sectionKey))

  const getSubGroupKeys = (subGroup: ReportSubGroup): string[] =>
    subGroup.sections.map(sectionKey)

  const getSelectionState = (keys: string[]): SelectionState => {
    const selectedKeyCount = keys.filter((key) => selectedSections.has(key)).length
    if (selectedKeyCount === 0) {
      return 'none'
    }
    if (selectedKeyCount === keys.length) {
      return 'all'
    }
    return 'some'
  }

  const handleToggleKeys = (keys: string[]) => {
    const selectionState = getSelectionState(keys)
    const nextSelection = new Set(selectedSections)

    if (selectionState === 'all') {
      keys.forEach((key) => nextSelection.delete(key))
    } else {
      keys.forEach((key) => nextSelection.add(key))
    }

    setSelectedSections(nextSelection)
  }

  const handleToggleSection = (section: AvailableSection) => {
    const key = sectionKey(section)
    const nextSelection = new Set(selectedSections)

    if (nextSelection.has(key)) {
      nextSelection.delete(key)
    } else {
      nextSelection.add(key)
    }

    setSelectedSections(nextSelection)
  }

  const handleToggleCategoryCollapse = (category: string) => {
    const nextCollapsedCategories = new Set(collapsedCategories)
    if (nextCollapsedCategories.has(category)) {
      nextCollapsedCategories.delete(category)
    } else {
      nextCollapsedCategories.add(category)
    }
    setCollapsedCategories(nextCollapsedCategories)
  }

  const handleSelectAll = () => {
    if (preview?.available_sections) {
      setSelectedSections(new Set(preview.available_sections.map(sectionKey)))
    }
  }

  const handleDeselectAll = () => {
    setSelectedSections(new Set())
  }

  const handleResultSetChange = (value: string) => {
    setSelectedResultSetId(Number(value) || null)
  }

  const handleToggleIncludeTable = (checked: boolean) => {
    setIncludeTable(checked)
    sectionCacheRef.current.clear()
  }

  const handleToggleIncludeChart = (checked: boolean) => {
    setIncludeChart(checked)
    sectionCacheRef.current.clear()
  }

  const handleGenerate = () => {
    if (!selectedResultSetId || selectedSections.size === 0) {
      return
    }

    const sections = buildSectionConfigs()
    if (sections.length === 0) {
      return
    }

    generateReport.mutate(
      {
        project_name: projectName,
        result_set_id: selectedResultSetId,
        sections,
      },
      {
        onSuccess: () => {
          onClose()
        },
      }
    )
  }

  const canGenerate = Boolean(selectedResultSetId && selectedSections.size > 0)

  const generateErrorMessage = generateReport.isError
    ? getApiErrorMessage(generateReport.error, 'Failed to generate report')
    : null

  const resultSetName = preview?.result_set?.name || ''

  const isSectionSelected = (section: AvailableSection) => selectedSections.has(sectionKey(section))

  return {
    canGenerate,
    categoryGroups,
    collapsedCategories,
    generateErrorMessage,
    includeChart,
    includeTable,
    isGenerating: generateReport.isPending,
    preview,
    previewError,
    previewLoading,
    previewMetaLoading,
    previewSections,
    resultSetName,
    resultSets,
    resultSetsLoading,
    selectedResultSetId,
    selectedSections,
    getCategoryKeys,
    getSelectionState,
    getSubGroupKeys,
    handleDeselectAll,
    handleGenerate,
    handleResultSetChange,
    handleSelectAll,
    handleToggleCategoryCollapse,
    handleToggleIncludeChart,
    handleToggleIncludeTable,
    handleToggleKeys,
    handleToggleSection,
    isSectionSelected,
  }
}
