/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { TreeCategoryNode, TreeCategoryTypeNode, TreeLeafNode } from './TreePrimitives'

export type TreeSchemaExpansionGroup = 'categories' | 'categoryTypes' | 'resultTypes'
export type TreeSchemaVariant = 'category' | 'categoryType'

export interface TreeSchemaBranchNode {
  children: TreeSchemaNode[]
  expansionGroup: TreeSchemaExpansionGroup
  icon: string
  key: string
  kind: 'branch'
  label: string
  variant: TreeSchemaVariant
}

export interface TreeSchemaLeafNode {
  icon?: string
  key: string
  kind: 'leaf'
  label: string
  onSelect: () => void
  selected?: boolean
}

export interface TreeSchemaTextNode {
  key: string
  kind: 'text'
  label: string
}

export type TreeSchemaNode = TreeSchemaBranchNode | TreeSchemaLeafNode | TreeSchemaTextNode

interface TreeSchemaRendererProps {
  expandedCategories: Set<string>
  expandedCategoryTypes: Set<string>
  expandedResultTypes: Set<string>
  nodes: TreeSchemaNode[]
  onToggleCategory: (key: string) => void
  onToggleCategoryType: (key: string) => void
  onToggleResultType: (key: string) => void
}

export function branchNode(node: Omit<TreeSchemaBranchNode, 'kind'>): TreeSchemaBranchNode {
  return {
    ...node,
    kind: 'branch',
  }
}

export function leafNode(node: Omit<TreeSchemaLeafNode, 'kind'>): TreeSchemaLeafNode {
  return {
    ...node,
    kind: 'leaf',
  }
}

export function textNode(node: Omit<TreeSchemaTextNode, 'kind'>): TreeSchemaTextNode {
  return {
    ...node,
    kind: 'text',
  }
}

function renderBranchNode(
  node: TreeSchemaBranchNode,
  props: TreeSchemaRendererProps
): ReactNode {
  const {
    expandedCategories,
    expandedCategoryTypes,
    expandedResultTypes,
    onToggleCategory,
    onToggleCategoryType,
    onToggleResultType,
  } = props

  const isExpanded =
    node.expansionGroup === 'categories'
      ? expandedCategories.has(node.key)
      : node.expansionGroup === 'categoryTypes'
        ? expandedCategoryTypes.has(node.key)
        : expandedResultTypes.has(node.key)

  const onToggle =
    node.expansionGroup === 'categories'
      ? () => onToggleCategory(node.key)
      : node.expansionGroup === 'categoryTypes'
        ? () => onToggleCategoryType(node.key)
        : () => onToggleResultType(node.key)

  const children = (
    <>
      {node.children.map((childNode) => renderSchemaNode(childNode, props))}
    </>
  )

  if (node.variant === 'category') {
    return (
      <TreeCategoryNode
        key={node.key}
        label={node.label}
        icon={node.icon}
        isExpanded={isExpanded}
        onToggle={onToggle}
      >
        {children}
      </TreeCategoryNode>
    )
  }

  return (
    <TreeCategoryTypeNode
      key={node.key}
      label={node.label}
      icon={node.icon}
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      {children}
    </TreeCategoryTypeNode>
  )
}

function renderSchemaNode(node: TreeSchemaNode, props: TreeSchemaRendererProps): ReactNode {
  if (node.kind === 'branch') {
    return renderBranchNode(node, props)
  }

  if (node.kind === 'text') {
    return (
      <div key={node.key} className="text-text-muted text-[13px] px-2 py-1">
        {node.label}
      </div>
    )
  }

  return (
    <TreeLeafNode
      key={node.key}
      label={node.label}
      icon={node.icon}
      isSelected={node.selected}
      onClick={node.onSelect}
    />
  )
}

export function TreeSchemaRenderer(props: TreeSchemaRendererProps) {
  return <>{props.nodes.map((node) => renderSchemaNode(node, props))}</>
}
