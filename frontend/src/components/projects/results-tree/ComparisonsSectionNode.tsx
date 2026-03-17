import { useComparisonSets, useDeleteComparisonSet } from '../../../hooks/useResults'
import { ICONS } from './constants'
import { ComparisonSetNode } from './ComparisonSetNode'
import { TreeSection } from './TreePrimitives'
import type { TreeAvailableTypes, TreeSelection } from './types'

interface ComparisonsSectionNodeProps {
  projectSlug: string
  availableTypes: TreeAvailableTypes | undefined
  currentSelection: TreeSelection | null
  isExpanded: boolean
  onToggleSection: () => void
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
  onToggleComparisonSet: (csKey: string, defaultSelection: TreeSelection | null) => void
}

export function ComparisonsSectionNode({
  projectSlug,
  availableTypes,
  currentSelection,
  isExpanded,
  onToggleSection,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleCategoryType,
  onToggleResultType,
  onSelect,
  onToggleComparisonSet,
}: ComparisonsSectionNodeProps) {
  const { data: comparisonSets } = useComparisonSets(projectSlug)
  const deleteMutation = useDeleteComparisonSet(projectSlug)

  if (!comparisonSets?.length) return null

  return (
    <TreeSection
      label="Comparisons"
      icon={ICONS.section}
      isExpanded={isExpanded}
      onToggle={onToggleSection}
    >
      {comparisonSets.map((cs) => (
        <ComparisonSetNode
          key={cs.id}
          comparisonSet={cs}
          projectSlug={projectSlug}
          availableTypes={availableTypes}
          currentSelection={currentSelection}
          expandedCategoryTypes={expandedCategoryTypes}
          expandedResultTypes={expandedResultTypes}
          onToggleCategoryType={onToggleCategoryType}
          onToggleResultType={onToggleResultType}
          onSelect={onSelect}
          onDelete={() => deleteMutation.mutate(cs.id)}
          onToggleComparisonSet={onToggleComparisonSet}
        />
      ))}
    </TreeSection>
  )
}
