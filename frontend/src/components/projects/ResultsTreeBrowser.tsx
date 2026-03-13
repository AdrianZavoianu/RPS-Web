/**
 * Results Tree Browser - Hierarchical navigation for project results
 * Replicates the desktop RPS tree browser structure exactly
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAvailableResultTypes, useResultSets } from '../../hooks/useResults'
import { isNlthaResultSet, isPushoverResultSet } from '../../utils/resultSets'
import { DEFAULT_GLOBAL_RESULTS, ICONS } from './results-tree/constants'
import { ComparisonsSectionNode } from './results-tree/ComparisonsSectionNode'
import { NLTHAResultSetNode } from './results-tree/NLTHAResultSetNode'
import { PushoverResultSetNode } from './results-tree/PushoverResultSetNode'
import { TreeSection } from './results-tree/TreePrimitives'
import { isComparisonSelection, type TreeSelection } from './results-tree/types'

export type { TreeSelection } from './results-tree/types'

interface ResultsTreeBrowserProps {
  projectSlug: string
  onSelect: (selection: TreeSelection) => void
  currentSelection: TreeSelection | null
  disableInitialAutoSelect?: boolean
  resultSetRootSelectsDefault?: boolean
}

const isResultSetBranchKey = (key: string, resultSetId: number) =>
  key.startsWith(`${resultSetId}-`) || key.startsWith(`push-${resultSetId}-`)

const getComparisonRootKey = (comparisonSetId: number) => `comp-${comparisonSetId}`

const isComparisonBranchKey = (key: string, comparisonSetId: number) => {
  const rootKey = getComparisonRootKey(comparisonSetId)
  return key === rootKey || key.startsWith(`${rootKey}-`)
}

export function ResultsTreeBrowser({
  projectSlug,
  onSelect,
  currentSelection,
  disableInitialAutoSelect = false,
  resultSetRootSelectsDefault = true,
}: ResultsTreeBrowserProps) {
  const { data: resultSets, isLoading } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)
  const [hasAutoSelectedInitial, setHasAutoSelectedInitial] = useState(false)

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['NLTHA']))
  const [expandedResultSets, setExpandedResultSets] = useState<Set<number>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedCategoryTypes, setExpandedCategoryTypes] = useState<Set<string>>(new Set())
  const [expandedResultTypes, setExpandedResultTypes] = useState<Set<string>>(new Set())

  const { nlthaResultSets, pushoverResultSets } = useMemo(() => {
    if (!resultSets) return { nlthaResultSets: [], pushoverResultSets: [] }

    return {
      nlthaResultSets: resultSets.filter(isNlthaResultSet),
      pushoverResultSets: resultSets.filter(isPushoverResultSet),
    }
  }, [resultSets])

  const collapseToActiveSet = useCallback((activeResultSetId: number | null, activeComparisonSetId: number | null) => {
    setExpandedResultSets(
      activeResultSetId !== null
        ? new Set<number>([activeResultSetId])
        : new Set<number>()
    )

    setExpandedCategories((previousKeys) => {
      if (activeResultSetId === null) return new Set<string>()

      const nextKeys = new Set<string>()
      for (const key of previousKeys) {
        if (isResultSetBranchKey(key, activeResultSetId)) nextKeys.add(key)
      }
      return nextKeys
    })

    setExpandedCategoryTypes((previousKeys) => {
      const nextKeys = new Set<string>()

      if (activeResultSetId !== null) {
        for (const key of previousKeys) {
          if (isResultSetBranchKey(key, activeResultSetId)) nextKeys.add(key)
        }
      }

      if (activeComparisonSetId !== null) {
        for (const key of previousKeys) {
          if (isComparisonBranchKey(key, activeComparisonSetId)) nextKeys.add(key)
        }
        nextKeys.add(getComparisonRootKey(activeComparisonSetId))
      }

      return nextKeys
    })

    setExpandedResultTypes((previousKeys) => {
      const nextKeys = new Set<string>()

      if (activeResultSetId !== null) {
        for (const key of previousKeys) {
          if (isResultSetBranchKey(key, activeResultSetId)) nextKeys.add(key)
        }
      }

      if (activeComparisonSetId !== null) {
        for (const key of previousKeys) {
          if (isComparisonBranchKey(key, activeComparisonSetId)) nextKeys.add(key)
        }
      }

      return nextKeys
    })
  }, [])

  const handleSelect = useCallback((selection: TreeSelection) => {
    const activeComparisonSetId = isComparisonSelection(selection)
      ? selection.comparisonSetId
      : null
    const activeResultSetId =
      !isComparisonSelection(selection) && selection.resultSetId > 0
        ? selection.resultSetId
        : null

    collapseToActiveSet(activeResultSetId, activeComparisonSetId)

    // Ensure time-series branch nodes are expanded when a TS leaf is selected
    if (selection.type === 'time_series' && activeResultSetId !== null) {
      setExpandedCategories(prev => new Set([...prev, `${activeResultSetId}-Time-Series`]))
      if (selection.loadCaseName) {
        setExpandedCategoryTypes(prev => new Set([...prev, `${activeResultSetId}-Time-Series-${selection.loadCaseName}`]))
      }
    }

    onSelect(selection)
  }, [collapseToActiveSet, onSelect])

  const globalResults = useMemo(
    () => availableTypes?.global_results || DEFAULT_GLOBAL_RESULTS,
    [availableTypes?.global_results]
  )

  // Auto-expand tree to show externally-provided selection (e.g. URL navigation)
  useEffect(() => {
    if (!currentSelection) return
    const rsId = currentSelection.resultSetId
    if (!rsId || rsId <= 0) return

    // Ensure result set is expanded
    setExpandedResultSets(prev => {
      if (prev.has(rsId)) return prev
      return new Set([rsId])
    })

    if (currentSelection.type === 'time_series') {
      const catKey = `${rsId}-Time-Series`
      setExpandedCategories(prev => {
        if (prev.has(catKey)) return prev
        return new Set([...prev, catKey])
      })
      if (currentSelection.loadCaseName) {
        const ctKey = `${rsId}-Time-Series-${currentSelection.loadCaseName}`
        setExpandedCategoryTypes(prev => {
          if (prev.has(ctKey)) return prev
          return new Set([...prev, ctKey])
        })
      }
    }
  }, [currentSelection])

  useEffect(() => {
    if (disableInitialAutoSelect) return
    if (!nlthaResultSets.length || hasAutoSelectedInitial) return

    const firstResultSetId = nlthaResultSets[0].id

    setExpandedResultSets(new Set([firstResultSetId]))
    setExpandedCategories(new Set([`${firstResultSetId}-Envelopes`]))
    setExpandedCategoryTypes(new Set([`${firstResultSetId}-Envelopes-Global`]))
    setExpandedResultTypes(new Set([`${firstResultSetId}-Drifts`]))

    handleSelect({
      type: 'global_result',
      resultSetId: firstResultSetId,
      category: 'Envelopes',
      categoryType: 'Global',
      resultType: 'Drifts',
      direction: 'X',
    })

    setHasAutoSelectedInitial(true)
  }, [disableInitialAutoSelect, handleSelect, hasAutoSelectedInitial, nlthaResultSets])

  const toggleSection = (section: string) => {
    setExpandedSections((previousSections) => {
      const nextSections = new Set(previousSections)
      if (nextSections.has(section)) nextSections.delete(section)
      else nextSections.add(section)
      return nextSections
    })
  }

  const toggleResultSet = useCallback((resultSetId: number) => {
    if (expandedResultSets.has(resultSetId)) {
      setExpandedResultSets((previousResultSets) => {
        const nextResultSets = new Set(previousResultSets)
        nextResultSets.delete(resultSetId)
        return nextResultSets
      })
      return
    }

    collapseToActiveSet(resultSetId, null)
  }, [collapseToActiveSet, expandedResultSets])

  const toggleCategory = (key: string) => {
    setExpandedCategories((previousKeys) => {
      const nextKeys = new Set(previousKeys)
      if (nextKeys.has(key)) nextKeys.delete(key)
      else nextKeys.add(key)
      return nextKeys
    })
  }

  const toggleCategoryType = (key: string) => {
    setExpandedCategoryTypes((previousKeys) => {
      const nextKeys = new Set(previousKeys)
      if (nextKeys.has(key)) nextKeys.delete(key)
      else nextKeys.add(key)
      return nextKeys
    })
  }

  const toggleResultType = (key: string) => {
    setExpandedResultTypes((previousKeys) => {
      const nextKeys = new Set(previousKeys)
      if (nextKeys.has(key)) nextKeys.delete(key)
      else nextKeys.add(key)
      return nextKeys
    })
  }

  const handleResultSetRootClick = useCallback((resultSetId: number) => {
    const firstGlobal = globalResults.find((resultType) => resultType.directions && resultType.directions.length > 0)
    const resultType = firstGlobal?.type || 'Drifts'
    const direction = firstGlobal?.directions?.[0] || 'X'

    handleSelect({
      type: 'global_result',
      resultSetId,
      category: 'Envelopes',
      categoryType: 'Global',
      resultType,
      direction,
    })

    setExpandedCategories(new Set([`${resultSetId}-Envelopes`]))
    setExpandedCategoryTypes(new Set([`${resultSetId}-Envelopes-Global`]))
    setExpandedResultTypes(new Set([`${resultSetId}-${resultType}`]))
  }, [globalResults, handleSelect])

  const handleToggleComparisonSet = useCallback(
    (comparisonSetKey: string, defaultSelection: TreeSelection | null) => {
      const comparisonSetId = Number(comparisonSetKey.replace('comp-', ''))
      if (!Number.isFinite(comparisonSetId) || comparisonSetId <= 0) return

      collapseToActiveSet(null, comparisonSetId)

      if (!defaultSelection) {
        setExpandedCategoryTypes(new Set([getComparisonRootKey(comparisonSetId)]))
        setExpandedResultTypes(new Set())
        return
      }

      handleSelect(defaultSelection)

      const rootKey = getComparisonRootKey(comparisonSetId)

      if (defaultSelection.type === 'comparison_global') {
        setExpandedCategoryTypes(new Set([rootKey, `${rootKey}-Global`]))
        setExpandedResultTypes(new Set([`${rootKey}-${defaultSelection.resultType}`]))
        return
      }

      if (defaultSelection.type === 'comparison_joint') {
        setExpandedCategoryTypes(new Set([rootKey, `${rootKey}-Joints`]))
        setExpandedResultTypes(new Set())
        return
      }

      if (defaultSelection.type === 'comparison_beam_rotations') {
        setExpandedCategoryTypes(
          new Set([
            rootKey,
            `${rootKey}-Elements`,
            `${rootKey}-Elements-Beams`,
          ])
        )
        setExpandedResultTypes(new Set())
        return
      }

      if (defaultSelection.type === 'comparison_column_rotations') {
        setExpandedCategoryTypes(
          new Set([
            rootKey,
            `${rootKey}-Elements`,
            `${rootKey}-Elements-Columns`,
            `${rootKey}-Elements-Columns-ColumnRotations`,
          ])
        )
        setExpandedResultTypes(new Set())
        return
      }

      setExpandedCategoryTypes(new Set([rootKey]))
      setExpandedResultTypes(new Set())
    },
    [collapseToActiveSet, handleSelect]
  )

  const isSelected = useCallback(
    (resultSetId: number, resultType: string, direction: string) =>
      currentSelection?.resultSetId === resultSetId &&
      currentSelection?.resultType === resultType &&
      currentSelection?.direction === direction,
    [currentSelection]
  )

  const sectionSchemas = useMemo(() => {
    type SectionSchema = {
      key: 'NLTHA' | 'Pushover'
      label: 'NLTHA' | 'Pushover'
      resultSetIds: number[]
      renderNode: (resultSetId: number) => JSX.Element
      footer?: JSX.Element | null
    }

    const nlthaById = new Map(nlthaResultSets.map((resultSet) => [resultSet.id, resultSet]))
    const pushoverById = new Map(pushoverResultSets.map((resultSet) => [resultSet.id, resultSet]))

    const schemas: SectionSchema[] = []

    if (nlthaResultSets.length > 0) {
      schemas.push({
        key: 'NLTHA',
        label: 'NLTHA',
        resultSetIds: nlthaResultSets.map((resultSet) => resultSet.id),
        renderNode: (resultSetId) => {
          const resultSet = nlthaById.get(resultSetId)
          if (!resultSet) return <></>

          return (
            <NLTHAResultSetNode
              key={resultSet.id}
              resultSet={resultSet}
              projectSlug={projectSlug}
              globalResults={globalResults}
              elementResults={availableTypes?.element_results || []}
              jointResults={availableTypes?.joint_results || []}
              currentSelection={currentSelection}
              isExpanded={expandedResultSets.has(resultSet.id)}
              expandedCategories={expandedCategories}
              expandedCategoryTypes={expandedCategoryTypes}
              expandedResultTypes={expandedResultTypes}
              onToggleResultSet={() =>
                resultSetRootSelectsDefault
                  ? handleResultSetRootClick(resultSet.id)
                  : toggleResultSet(resultSet.id)
              }
              onToggleCategory={toggleCategory}
              onToggleCategoryType={toggleCategoryType}
              onToggleResultType={toggleResultType}
              onSelect={handleSelect}
              isSelected={isSelected}
            />
          )
        },
        footer: (
          <ComparisonsSectionNode
            projectSlug={projectSlug}
            availableTypes={availableTypes}
            currentSelection={currentSelection}
            isExpanded={expandedSections.has('Comparisons')}
            onToggleSection={() => toggleSection('Comparisons')}
            expandedCategoryTypes={expandedCategoryTypes}
            expandedResultTypes={expandedResultTypes}
            onToggleCategoryType={toggleCategoryType}
            onToggleResultType={toggleResultType}
            onSelect={handleSelect}
            onToggleComparisonSet={handleToggleComparisonSet}
          />
        ),
      })
    }

    if (pushoverResultSets.length > 0) {
      schemas.push({
        key: 'Pushover',
        label: 'Pushover',
        resultSetIds: pushoverResultSets.map((resultSet) => resultSet.id),
        renderNode: (resultSetId) => {
          const resultSet = pushoverById.get(resultSetId)
          if (!resultSet) return <></>

          return (
            <PushoverResultSetNode
              key={resultSet.id}
              projectSlug={projectSlug}
              resultSet={resultSet}
              currentSelection={currentSelection}
              isExpanded={expandedResultSets.has(resultSet.id)}
              onToggle={() => toggleResultSet(resultSet.id)}
              expandedCategories={expandedCategories}
              expandedCategoryTypes={expandedCategoryTypes}
              expandedResultTypes={expandedResultTypes}
              onToggleCategory={toggleCategory}
              onToggleCategoryType={toggleCategoryType}
              onToggleResultType={toggleResultType}
              onSelect={handleSelect}
            />
          )
        },
      })
    }

    return schemas
  }, [
    availableTypes,
    currentSelection,
    expandedCategories,
    expandedCategoryTypes,
    expandedResultSets,
    expandedResultTypes,
    expandedSections,
    globalResults,
    handleResultSetRootClick,
    handleSelect,
    handleToggleComparisonSet,
    isSelected,
    nlthaResultSets,
    projectSlug,
    pushoverResultSets,
    resultSetRootSelectsDefault,
    toggleResultSet,
  ])

  if (isLoading) {
    return (
      <div className="tree-browser p-3">
        <div className="text-[15px] text-text-muted">Loading...</div>
      </div>
    )
  }

  if (!resultSets?.length) {
    return (
      <div className="tree-browser p-3">
        <div className="text-[15px] text-text-muted">No result sets imported</div>
      </div>
    )
  }

  return (
    <div className="tree-browser overflow-y-auto">
      <div className="tree-header px-3 py-2">
        <span className="text-lg font-semibold text-text-primary">Results</span>
      </div>

      <div className="tree-content p-1">
        {sectionSchemas.map((section) => (
          <TreeSection
            key={section.key}
            label={section.label}
            icon={ICONS.section}
            isExpanded={expandedSections.has(section.key)}
            onToggle={() => toggleSection(section.key)}
          >
            {section.resultSetIds.map((resultSetId) => section.renderNode(resultSetId))}
            {section.footer || null}
          </TreeSection>
        ))}
      </div>
    </div>
  )
}
