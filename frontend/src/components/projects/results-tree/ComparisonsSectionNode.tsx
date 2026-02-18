import { useMemo } from 'react'
import { useComparisonSets, useDeleteComparisonSet, useElementsForType } from '../../../hooks/useResults'
import type { ComparisonSet } from '../../../types'
import {
  COMP_BEAM_ROTATIONS,
  COMP_ELEMENT_TYPE_MAP,
  COMP_GLOBAL_TYPES,
  COMP_JOINT_LABELS,
  COMP_JOINT_TYPES,
  ICONS,
  naturalCompare,
} from './constants'
import { ComparisonResultTypeNode, TreeCategoryTypeNode, TreeLeafNode, TreeSection } from './TreePrimitives'
import { isComparisonSelection, type TreeAvailableTypes, type TreeSelection } from './types'

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

interface ComparisonSetNodeProps {
  comparisonSet: ComparisonSet
  projectSlug: string
  availableTypes: ComparisonsSectionNodeProps['availableTypes']
  currentSelection: TreeSelection | null
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleCategoryType: (key: string) => void
  onToggleComparisonSet: (csKey: string, defaultSelection: TreeSelection | null) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
  onDelete: () => void
}

function ComparisonSetNode({
  comparisonSet: cs,
  projectSlug,
  availableTypes,
  currentSelection,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleCategoryType,
  onToggleComparisonSet,
  onToggleResultType,
  onSelect,
  onDelete,
}: ComparisonSetNodeProps) {
  const csKey = `comp-${cs.id}`
  const isExpanded = expandedCategoryTypes.has(csKey)

  const globalTypes = cs.result_types.filter((t) => COMP_GLOBAL_TYPES.includes(t))
  const elementTypes = cs.result_types.filter((t) => t in COMP_ELEMENT_TYPE_MAP)
  const jointTypes = cs.result_types.filter((t) => COMP_JOINT_TYPES.includes(t))
  const hasBeamRotations = cs.result_types.includes(COMP_BEAM_ROTATIONS)
  const hasColumnRotations = cs.result_types.includes('ColumnRotations')

  const hasGlobal = globalTypes.length > 0
  const hasElements = elementTypes.length > 0 || hasBeamRotations
  const hasJoints = jointTypes.length > 0

  // Build element groups
  const elementGroups = useMemo(() => {
    const groups: Record<string, Array<{ type: string; label: string; directions: string[] }>> = {}
    for (const t of elementTypes) {
      const info = COMP_ELEMENT_TYPE_MAP[t]
      if (!info) continue
      if (!groups[info.group]) groups[info.group] = []
      groups[info.group].push({ type: t, label: info.label, directions: info.directions })
    }
    return groups
  }, [elementTypes])

  type ComparisonSelectionType = 'comparison_global' | 'comparison_element' | 'comparison_joint'

  const makeSelection = (
    type: ComparisonSelectionType,
    resultType: string,
    direction: string,
    elementId?: number,
    elementType?: string,
  ): TreeSelection => ({
    type,
    resultSetId: -1,
    category: 'Envelopes',
    resultType,
    direction,
    comparisonSetId: cs.id,
    comparisonSetName: cs.name,
    resultSetIds: cs.result_set_ids,
    elementId,
    elementType,
  })

  const isCompSelected = (
    type: string,
    resultType: string,
    direction: string,
    elementId?: number
  ) =>
    isComparisonSelection(currentSelection) &&
    currentSelection.comparisonSetId === cs.id &&
    currentSelection.type === type &&
    currentSelection.resultType === resultType &&
    currentSelection.direction === direction &&
    (elementId === undefined || currentSelection.elementId === elementId)

  const getDefaultSelection = (): TreeSelection | null => {
    const firstGlobalType = globalTypes[0]
    if (firstGlobalType) {
      const dirs = availableTypes?.global_results.find((r) => r.type === firstGlobalType)?.directions || ['X', 'Y']
      return makeSelection('comparison_global', firstGlobalType, dirs[0] || 'X')
    }

    if (hasBeamRotations) {
      return {
        type: 'comparison_beam_rotations',
        resultSetId: -1,
        category: 'Envelopes',
        resultType: 'BeamRotations',
        direction: '',
        comparisonSetId: cs.id,
        comparisonSetName: cs.name,
        resultSetIds: cs.result_set_ids,
      }
    }

    if (hasColumnRotations) {
      return {
        type: 'comparison_column_rotations',
        resultSetId: -1,
        category: 'Envelopes',
        resultType: 'ColumnRotations',
        direction: '',
        comparisonSetId: cs.id,
        comparisonSetName: cs.name,
        resultSetIds: cs.result_set_ids,
      }
    }

    if (jointTypes.length > 0) {
      return makeSelection('comparison_joint', jointTypes[0], '')
    }

    return null
  }

  return (
    <div className="tree-comparison-set">
      <div className="flex items-center group">
        <button
          onClick={() => onToggleComparisonSet(csKey, getDefaultSelection())}
          className="tree-item flex-1 text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
        >
          <span className="text-accent-primary text-[13px]">{ICONS.category}</span>
          <span className="text-text-secondary font-medium">{cs.name}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-text-muted hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete comparison set"
        >
          &times;
        </button>
      </div>

      {isExpanded && (
        <div className="tree-children ml-3">
          {/* Global */}
          {hasGlobal && (
            <TreeCategoryTypeNode
              label="Global"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(`${csKey}-Global`)}
              onToggle={() => onToggleCategoryType(`${csKey}-Global`)}
            >
              {globalTypes.map((rt) => {
                const dirs = availableTypes?.global_results.find((r) => r.type === rt)?.directions || ['X', 'Y']
                const rtKey = `${csKey}-${rt}`
                return (
                  <ComparisonResultTypeNode
                    key={rt}
                    label={rt}
                    directions={dirs}
                    isExpanded={expandedResultTypes.has(rtKey)}
                    onToggle={() => onToggleResultType(rtKey)}
                    onSelectDirection={(dir) => onSelect(makeSelection('comparison_global', rt, dir))}
                    isSelected={(dir) => isCompSelected('comparison_global', rt, dir)}
                  />
                )
              })}
            </TreeCategoryTypeNode>
          )}

          {/* Elements */}
          {hasElements && (
            <TreeCategoryTypeNode
              label="Elements"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(`${csKey}-Elements`)}
              onToggle={() => onToggleCategoryType(`${csKey}-Elements`)}
            >
              {Object.entries(elementGroups).map(([groupName, types]) => (
                <ComparisonElementGroupNode
                  key={groupName}
                  groupName={groupName}
                  types={types}
                  csKey={csKey}
                  projectSlug={projectSlug}
                  resultSetIds={cs.result_set_ids}
                  csId={cs.id}
                  csName={cs.name}
                  currentSelection={currentSelection}
                  expandedCategoryTypes={expandedCategoryTypes}
                  expandedResultTypes={expandedResultTypes}
                  onToggleCategoryType={onToggleCategoryType}
                  onToggleResultType={onToggleResultType}
                  onSelect={onSelect}
                />
              ))}
              {hasBeamRotations && (
                <TreeCategoryTypeNode
                  label="Beams"
                  icon={ICONS.resultType}
                  isExpanded={expandedCategoryTypes.has(`${csKey}-Elements-Beams`)}
                  onToggle={() => onToggleCategoryType(`${csKey}-Elements-Beams`)}
                >
                  <TreeLeafNode
                    label={`${ICONS.branchLast} R3 Plastic Rotations`}
                    onClick={() =>
                      onSelect({
                        type: 'comparison_beam_rotations',
                        resultSetId: -1,
                        category: 'Envelopes',
                        resultType: 'BeamRotations',
                        direction: '',
                        comparisonSetId: cs.id,
                        comparisonSetName: cs.name,
                        resultSetIds: cs.result_set_ids,
                      })
                    }
                    isSelected={
                      isComparisonSelection(currentSelection) &&
                      currentSelection.comparisonSetId === cs.id &&
                      currentSelection?.type === 'comparison_beam_rotations'
                    }
                  />
                </TreeCategoryTypeNode>
              )}
            </TreeCategoryTypeNode>
          )}

          {/* Joints */}
          {hasJoints && (
            <TreeCategoryTypeNode
              label="Joints"
              icon={ICONS.categoryType}
              isExpanded={expandedCategoryTypes.has(`${csKey}-Joints`)}
              onToggle={() => onToggleCategoryType(`${csKey}-Joints`)}
            >
              {jointTypes.map((jt) => (
                <TreeLeafNode
                  key={jt}
                  label={COMP_JOINT_LABELS[jt] || jt}
                  icon={ICONS.resultType}
                  onClick={() => onSelect(makeSelection('comparison_joint', jt, ''))}
                  isSelected={isCompSelected('comparison_joint', jt, '')}
                />
              ))}
            </TreeCategoryTypeNode>
          )}
        </div>
      )}
    </div>
  )
}

// Element group node within a comparison set tree
interface ComparisonElementGroupNodeProps {
  groupName: string
  types: Array<{ type: string; label: string; directions: string[] }>
  csKey: string
  projectSlug: string
  resultSetIds: number[]
  csId: number
  csName: string
  currentSelection: TreeSelection | null
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
  onSelect: (selection: TreeSelection) => void
}

function ComparisonElementGroupNode({
  groupName,
  types,
  csKey,
  projectSlug,
  resultSetIds,
  csId,
  csName,
  currentSelection,
  expandedCategoryTypes,
  expandedResultTypes,
  onToggleCategoryType,
  onToggleResultType,
  onSelect,
}: ComparisonElementGroupNodeProps) {
  const groupKey = `${csKey}-Elements-${groupName}`
  const groupIsExpanded = expandedCategoryTypes.has(groupKey)

  // Fetch elements using first result set
  const firstRsId = resultSetIds[0]
  const firstType = types[0]?.type
  const { data: elementsData } = useElementsForType(
    projectSlug,
    groupIsExpanded && firstRsId && firstType
      ? { result_set_id: firstRsId, result_type: firstType }
      : null
  )
  const elements = useMemo(
    () => [...(elementsData?.elements || [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [elementsData]
  )

  return (
    <TreeCategoryTypeNode
      label={groupName}
      icon={ICONS.resultType}
      isExpanded={groupIsExpanded}
      onToggle={() => onToggleCategoryType(groupKey)}
    >
      {types.map((typeInfo) => {
        const typeKey = `${groupKey}-${typeInfo.type}`

        // Types with no directions (e.g. BeamRotations) — per-element leaves directly
        if (typeInfo.directions.length === 0) {
          return (
            <TreeCategoryTypeNode
              key={typeInfo.type}
              label={typeInfo.label}
              icon={ICONS.resultType}
              isExpanded={expandedCategoryTypes.has(typeKey)}
              onToggle={() => onToggleCategoryType(typeKey)}
            >
              {elements.map((element, idx) => {
                const isLast = idx === elements.length - 1
                return (
                  <TreeLeafNode
                    key={element.id}
                    label={`${isLast ? ICONS.branchLast : ICONS.branch} ${element.name}`}
                    onClick={() =>
                      onSelect({
                        type: 'comparison_element',
                        resultSetId: -1,
                        category: 'Envelopes',
                        resultType: typeInfo.type,
                        direction: '',
                        elementId: element.id,
                        elementType: groupName.slice(0, -1),
                        comparisonSetId: csId,
                        comparisonSetName: csName,
                        resultSetIds,
                      })
                    }
                    isSelected={
                      isComparisonSelection(currentSelection) &&
                      currentSelection.comparisonSetId === csId &&
                      currentSelection?.type === 'comparison_element' &&
                      currentSelection?.resultType === typeInfo.type &&
                      currentSelection?.elementId === element.id
                    }
                  />
                )
              })}
            </TreeCategoryTypeNode>
          )
        }

        // Types with directions - show per-element with direction leaves
        return (
          <TreeCategoryTypeNode
            key={typeInfo.type}
            label={typeInfo.label}
            icon={ICONS.resultType}
            isExpanded={expandedCategoryTypes.has(typeKey)}
            onToggle={() => onToggleCategoryType(typeKey)}
          >
            {groupName === 'Columns' && typeInfo.type === 'ColumnRotations' && (
              <TreeLeafNode
                label={`${elements.length ? ICONS.branch : ICONS.branchLast} All Rotations`}
                onClick={() =>
                  onSelect({
                    type: 'comparison_column_rotations',
                    resultSetId: -1,
                    category: 'Envelopes',
                    resultType: 'ColumnRotations',
                    direction: '',
                    comparisonSetId: csId,
                    comparisonSetName: csName,
                    resultSetIds,
                  })
                }
                isSelected={
                  isComparisonSelection(currentSelection) &&
                  currentSelection.comparisonSetId === csId &&
                  currentSelection?.type === 'comparison_column_rotations'
                }
              />
            )}
            {elements.map((element, idx) => {
              const elKey = `${typeKey}-${element.id}`
              const isLast = idx === elements.length - 1
              return (
                <TreeCategoryTypeNode
                  key={element.id}
                  label={`${isLast ? ICONS.branchLast : ICONS.branch} ${element.name}`}
                  icon={ICONS.resultType}
                  isExpanded={expandedResultTypes.has(elKey)}
                  onToggle={() => onToggleResultType(elKey)}
                >
                  {typeInfo.directions.map((dir, dirIdx) => (
                    <TreeLeafNode
                      key={dir}
                      label={`${dirIdx < typeInfo.directions.length - 1 ? ICONS.branch : ICONS.branchLast} ${dir}`}
                      onClick={() =>
                        onSelect({
                          type: 'comparison_element',
                          resultSetId: -1,
                          category: 'Envelopes',
                          resultType: typeInfo.type,
                          direction: dir,
                          elementId: element.id,
                          elementType: groupName.slice(0, -1),
                          comparisonSetId: csId,
                          comparisonSetName: csName,
                          resultSetIds,
                        })
                      }
                      isSelected={
                        isComparisonSelection(currentSelection) &&
                        currentSelection.comparisonSetId === csId &&
                        currentSelection?.type === 'comparison_element' &&
                        currentSelection?.resultType === typeInfo.type &&
                        currentSelection?.direction === dir &&
                        currentSelection?.elementId === element.id
                      }
                    />
                  ))}
                </TreeCategoryTypeNode>
              )
            })}
          </TreeCategoryTypeNode>
        )
      })}
    </TreeCategoryTypeNode>
  )
}
