import { useMemo } from 'react'
import { useResultTreeMetadata } from '../../../hooks/useResults'
import type { ResultSet } from '../../../types'
import { ICONS } from './constants'
import { buildPushoverResultSetSchema } from './pushoverSchema'
import { TreeSchemaRenderer } from './treeSchema'
import type { TreeSelection } from './types'

interface PushoverResultSetNodeProps {
  currentSelection: TreeSelection | null
  expandedCategories: Set<string>
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  isExpanded: boolean
  onSelect: (selection: TreeSelection) => void
  onToggle: () => void
  onToggleCategory: (key: string) => void
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
  projectSlug: string
  resultSet: ResultSet
}

export function PushoverResultSetNode({
  currentSelection,
  expandedCategories,
  expandedCategoryTypes,
  expandedResultTypes,
  isExpanded,
  onSelect,
  onToggle,
  onToggleCategory,
  onToggleCategoryType,
  onToggleResultType,
  projectSlug,
  resultSet,
}: PushoverResultSetNodeProps) {
  const { data: treeMetadata } = useResultTreeMetadata(
    projectSlug,
    isExpanded ? resultSet.id : undefined
  )

  const schemaNodes = useMemo(
    () =>
      buildPushoverResultSetSchema({
        currentSelection,
        onSelect,
        resultSet,
        treeMetadata,
      }),
    [currentSelection, onSelect, resultSet, treeMetadata]
  )

  return (
    <div className="tree-result-set">
      <button
        onClick={onToggle}
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
