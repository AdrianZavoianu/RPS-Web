/**
 * Shared subtree builders used by both NLTHA and pushover result-set schemas.
 *
 * Each builder produces a fragment of the tree (branch/leaf nodes) that is
 * structurally identical across analysis types, parameterised only by
 * key-prefix, element list, and whether MaxMin leaves are included.
 */

import { ICONS, naturalCompare } from './constants'
import type { TreeSelection } from './types'
import { branchNode, leafNode, type TreeSchemaNode } from './treeSchema'

// ── Shared helpers ──────────────────────────────────────────────────────────

export interface TreeBuilderContext {
  resultSetId: number
  currentSelection: TreeSelection | null
  onSelect: (selection: TreeSelection) => void
}

export interface TreeElement {
  id: number
  name: string
}

function branchPrefix(index: number, total: number): string {
  return index === total - 1 ? ICONS.branchLast : ICONS.branch
}

function isElementSelected(
  sel: TreeSelection | null,
  resultSetId: number,
  resultType: string,
  direction: string,
  elementId?: number,
): boolean {
  if (!sel || sel.type !== 'element') return false
  return (
    sel.resultSetId === resultSetId &&
    sel.resultType === resultType &&
    sel.direction === direction &&
    (elementId === undefined || sel.elementId === elementId)
  )
}

function isMaxMinSelected(
  sel: TreeSelection | null,
  resultSetId: number,
  resultType: string,
  elementId?: number,
): boolean {
  if (!sel || sel.type !== 'maxmin') return false
  return (
    sel.resultSetId === resultSetId &&
    sel.resultType === resultType &&
    (elementId === undefined || sel.elementId === elementId)
  )
}

// ── Element direction leaves ────────────────────────────────────────────────

/** Build direction + optional MaxMin leaf nodes for one element. */
export function buildElementDirectionLeaves(
  ctx: TreeBuilderContext,
  parentKey: string,
  resultType: string,
  elementType: string,
  elementId: number,
  directions: string[],
  includeMaxMin: boolean,
): TreeSchemaNode[] {
  const leaves: TreeSchemaNode[] = directions.map((direction, i) =>
    leafNode({
      key: `${parentKey}-${direction}`,
      label: `${i < directions.length - 1 || includeMaxMin ? ICONS.branch : ICONS.branchLast} ${direction}`,
      onSelect: () =>
        ctx.onSelect({
          type: 'element',
          resultSetId: ctx.resultSetId,
          category: 'Envelopes',
          categoryType: 'Elements',
          resultType,
          direction,
          elementType,
          elementId,
        }),
      selected: isElementSelected(ctx.currentSelection, ctx.resultSetId, resultType, direction, elementId),
    }),
  )

  if (includeMaxMin) {
    leaves.push(
      leafNode({
        key: `${parentKey}-MaxMin`,
        label: `${ICONS.branchLast} Max/Min`,
        onSelect: () =>
          ctx.onSelect({
            type: 'maxmin',
            resultSetId: ctx.resultSetId,
            category: 'Envelopes',
            categoryType: 'Elements',
            resultType,
            direction: 'MaxMin',
            elementType,
            elementId,
          }),
        selected: isMaxMinSelected(ctx.currentSelection, ctx.resultSetId, resultType, elementId),
      }),
    )
  }

  return leaves
}

// ── Per-element branches ────────────────────────────────────────────────────

/** Build a list of per-element branch nodes, each containing direction leaves. */
export function buildPerElementBranches(
  ctx: TreeBuilderContext,
  parentKey: string,
  elements: TreeElement[],
  resultType: string,
  elementType: string,
  directions: string[],
  includeMaxMin: boolean,
): TreeSchemaNode[] {
  return elements.map((element, index) => {
    const elementKey = `${parentKey}-${element.id}`
    return branchNode({
      key: elementKey,
      label: `${branchPrefix(index, elements.length)} ${element.name}`,
      icon: ICONS.resultType,
      expansionGroup: 'categoryTypes',
      variant: 'categoryType',
      children: buildElementDirectionLeaves(
        ctx,
        elementKey,
        resultType,
        elementType,
        element.id,
        directions,
        includeMaxMin,
      ),
    })
  })
}

// ── Column rotations subtree ────────────────────────────────────────────────

/** Build the children of the "Rotations" branch under Columns. */
export function buildColumnRotationsChildren(
  ctx: TreeBuilderContext,
  rotationsKey: string,
  elements: TreeElement[],
  includeMaxMin: boolean,
): TreeSchemaNode[] {
  const children: TreeSchemaNode[] = [
    leafNode({
      key: `${rotationsKey}-all`,
      label: `${elements.length ? ICONS.branch : ICONS.branchLast} All Rotations`,
      onSelect: () =>
        ctx.onSelect({
          type: 'column_rotations_plot',
          resultSetId: ctx.resultSetId,
          category: 'Envelopes',
          categoryType: 'Elements',
          resultType: 'AllColumnRotations',
          direction: '',
          elementType: 'Column',
        }),
      selected:
        ctx.currentSelection?.type === 'column_rotations_plot' &&
        ctx.currentSelection.resultSetId === ctx.resultSetId,
    }),
  ]

  children.push(
    ...buildPerElementBranches(ctx, rotationsKey, elements, 'ColumnRotations', 'Column', ['R2', 'R3'], includeMaxMin),
  )

  return children
}

// ── Beam rotations subtree ──────────────────────────────────────────────────

/** Build the "Beams" branch node with R3 Plastic Rotations (Plot + Table). */
export function buildBeamRotationsSubtree(
  ctx: TreeBuilderContext,
  beamsKey: string,
  beamRotationsKey: string,
): TreeSchemaNode {
  return branchNode({
    key: beamsKey,
    label: 'Beams',
    icon: ICONS.categoryType,
    expansionGroup: 'categoryTypes',
    variant: 'categoryType',
    children: [
      branchNode({
        key: beamRotationsKey,
        label: 'R3 Plastic Rotations',
        icon: ICONS.resultType,
        expansionGroup: 'categoryTypes',
        variant: 'categoryType',
        children: [
          leafNode({
            key: `${beamRotationsKey}-plot`,
            label: `${ICONS.branch} Plot`,
            onSelect: () =>
              ctx.onSelect({
                type: 'beam_rotations_plot',
                resultSetId: ctx.resultSetId,
                category: 'Envelopes',
                categoryType: 'Elements',
                resultType: 'AllBeamRotations',
                direction: '',
                elementType: 'Beam',
              }),
            selected:
              ctx.currentSelection?.type === 'beam_rotations_plot' &&
              ctx.currentSelection.resultSetId === ctx.resultSetId,
          }),
          leafNode({
            key: `${beamRotationsKey}-table`,
            label: `${ICONS.branchLast} Table`,
            onSelect: () =>
              ctx.onSelect({
                type: 'beam_rotations_table',
                resultSetId: ctx.resultSetId,
                category: 'Envelopes',
                categoryType: 'Elements',
                resultType: 'BeamRotationsTable',
                direction: '',
                elementType: 'Beam',
              }),
            selected:
              ctx.currentSelection?.type === 'beam_rotations_table' &&
              ctx.currentSelection.resultSetId === ctx.resultSetId,
          }),
        ],
      }),
    ],
  })
}

// ── Joint result branch ─────────────────────────────────────────────────────

/** Build a joint-result branch (Plot + Table leaves). */
export function buildJointResultBranch(
  ctx: TreeBuilderContext,
  key: string,
  label: string,
  resultType: string,
): TreeSchemaNode {
  return branchNode({
    key,
    label,
    icon: ICONS.resultType,
    expansionGroup: 'categoryTypes',
    variant: 'categoryType',
    children: [
      leafNode({
        key: `${key}-plot`,
        label: `${ICONS.branch} Plot`,
        onSelect: () =>
          ctx.onSelect({
            type: 'joint_plot',
            resultSetId: ctx.resultSetId,
            category: 'Envelopes',
            categoryType: 'Joints',
            resultType,
            direction: 'Min',
          }),
        selected:
          ctx.currentSelection?.type === 'joint_plot' &&
          ctx.currentSelection.resultSetId === ctx.resultSetId &&
          ctx.currentSelection.resultType === resultType,
      }),
      leafNode({
        key: `${key}-table`,
        label: `${ICONS.branchLast} Table`,
        onSelect: () =>
          ctx.onSelect({
            type: 'joint_table',
            resultSetId: ctx.resultSetId,
            category: 'Envelopes',
            categoryType: 'Joints',
            resultType,
            direction: 'Min',
          }),
        selected:
          ctx.currentSelection?.type === 'joint_table' &&
          ctx.currentSelection.resultSetId === ctx.resultSetId &&
          ctx.currentSelection.resultType === resultType,
      }),
    ],
  })
}

// ── Sorted element list helper ──────────────────────────────────────────────

/** Extract and sort elements for a given cache type from tree metadata. */
export function sortedElements(
  elementsByType: Record<string, TreeElement[]> | undefined,
  cacheType: string,
): TreeElement[] {
  return [...(elementsByType?.[cacheType] ?? [])].sort((a, b) => naturalCompare(a.name, b.name))
}
