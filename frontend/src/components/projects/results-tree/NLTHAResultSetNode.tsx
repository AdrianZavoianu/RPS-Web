import { useMemo } from 'react'
import { useResultTreeMetadata } from '../../../hooks/useResults'
import type { ResultSet } from '../../../types'
import { ICONS } from './constants'
import { buildNlthaResultSetSchema } from './nlthaSchema'
import { TreeSchemaRenderer } from './treeSchema'
import type { TreeSelection } from './types'

interface NLTHAResultSetNodeProps {
  currentSelection: TreeSelection | null
  elementResults: Array<{ type: string; directions: string[] | null }>
  expandedCategories: Set<string>
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  globalResults: Array<{ type: string; directions: string[] | null }>
  isExpanded: boolean
  isSelected: (resultSetId: number, resultType: string, direction: string) => boolean
  jointResults: Array<{ type: string; directions?: string[] | null }>
  onSelect: (selection: TreeSelection) => void
  onToggleCategory: (key: string) => void
  onToggleCategoryType: (key: string) => void
  onToggleResultSet: () => void
  onToggleResultType: (key: string) => void
  projectSlug: string
  resultSet: ResultSet
}

export function NLTHAResultSetNode({
  currentSelection,
  elementResults,
  expandedCategories,
  expandedCategoryTypes,
  expandedResultTypes,
  globalResults,
  isExpanded,
  isSelected,
  jointResults,
  onSelect,
  onToggleCategory,
  onToggleCategoryType,
  onToggleResultSet,
  onToggleResultType,
  projectSlug,
  resultSet,
}: NLTHAResultSetNodeProps) {
  const { data: treeMetadata } = useResultTreeMetadata(
    projectSlug,
    isExpanded ? resultSet.id : undefined
  )

  const schemaNodes = useMemo(
    () =>
      buildNlthaResultSetSchema({
        currentSelection,
        elementResults,
        globalResults,
        isSelected,
        jointResults,
        onSelect,
        resultSet,
        treeMetadata,
      }),
    [
      currentSelection,
      elementResults,
      globalResults,
      isSelected,
      jointResults,
      onSelect,
      resultSet,
      treeMetadata,
    ]
  )

  return (
    <div className="tree-result-set">
      <button
        onClick={onToggleResultSet}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultSet}</span>
        <span className="text-text-secondary">{resultSet.name}</span>
      </button>

      {isExpanded && (
        <div className="tree-children ml-3">
          <TreeSchemaRenderer
            nodes={schemaNodes}
            expandedCategories={expandedCategories}
            expandedCategoryTypes={expandedCategoryTypes}
            expandedResultTypes={expandedResultTypes}
            onToggleCategory={onToggleCategory}
            onToggleCategoryType={onToggleCategoryType}
            onToggleResultType={onToggleResultType}
          />
        </div>
      )}
    </div>
  )
}
