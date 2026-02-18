import clsx from 'clsx'
import type { ReactNode } from 'react'
import { ICONS } from './constants'

interface TreeSectionProps {
  label: string
  icon: string
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
}

export function TreeSection({ label, icon, isExpanded, onToggle, children }: TreeSectionProps) {
  return (
    <div className="tree-section">
      <button
        onClick={onToggle}
        className="tree-item tree-item-section w-full text-left flex items-center gap-1 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-accent-primary">{icon}</span>
        <span className="font-medium text-text-primary">{label}</span>
      </button>
      {isExpanded && <div className="tree-children ml-2">{children}</div>}
    </div>
  )
}

interface TreeCategoryNodeProps {
  label: string
  icon: string
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
}

export function TreeCategoryNode({ label, icon, isExpanded, onToggle, children }: TreeCategoryNodeProps) {
  return (
    <div className="tree-category">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-accent-primary text-[13px]">{icon}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && <div className="tree-children ml-3">{children}</div>}
    </div>
  )
}

interface TreeCategoryTypeNodeProps {
  label: string
  icon: string
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
}

export function TreeCategoryTypeNode({
  label,
  icon,
  isExpanded,
  onToggle,
  children,
}: TreeCategoryTypeNodeProps) {
  return (
    <div className="tree-category-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{icon}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && <div className="tree-children ml-3">{children}</div>}
    </div>
  )
}

interface TreeResultTypeNodeProps {
  label: string
  directions: string[]
  isExpanded: boolean
  onToggle: () => void
  onSelectDirection: (direction: string) => void
  onSelectMaxMin: () => void
  isSelected: (direction: string) => boolean
}

export function TreeResultTypeNode({
  label,
  directions,
  isExpanded,
  onToggle,
  onSelectDirection,
  onSelectMaxMin,
  isSelected,
}: TreeResultTypeNodeProps) {
  return (
    <div className="tree-result-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultType}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && (
        <div className="tree-children ml-4">
          {directions.map((direction, index) => (
            <button
              key={direction}
              onClick={() => onSelectDirection(direction)}
              className={clsx(
                'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
                isSelected(direction)
                  ? 'bg-accent-primary/15 text-accent-secondary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              )}
            >
              {index < directions.length - 1 ? ICONS.branch : ICONS.branchLast} {direction} Direction
            </button>
          ))}
          <button
            onClick={onSelectMaxMin}
            className={clsx(
              'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
              isSelected('MaxMin')
                ? 'bg-accent-primary/15 text-accent-secondary'
                : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
            )}
          >
            {ICONS.branchLast} Max/Min
          </button>
        </div>
      )}
    </div>
  )
}

interface TreeDirectionNodeProps {
  label: string
  directions: string[]
  isExpanded: boolean
  onToggle: () => void
  onSelectDirection: (direction: string) => void
  isSelected: (direction: string) => boolean
}

export function TreeDirectionNode({
  label,
  directions,
  isExpanded,
  onToggle,
  onSelectDirection,
  isSelected,
}: TreeDirectionNodeProps) {
  return (
    <div className="tree-result-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultType}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && (
        <div className="tree-children ml-4">
          {directions.map((direction, index) => (
            <button
              key={direction}
              onClick={() => onSelectDirection(direction)}
              className={clsx(
                'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
                isSelected(direction)
                  ? 'bg-accent-primary/15 text-accent-secondary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              )}
            >
              {index < directions.length - 1 ? ICONS.branch : ICONS.branchLast} {direction}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface TreeLeafNodeProps {
  label: string
  icon?: string
  onClick: () => void
  isSelected?: boolean
}

export function TreeLeafNode({ label, icon, onClick, isSelected }: TreeLeafNodeProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'tree-item tree-leaf w-full text-left flex items-center gap-1 py-1 px-2 rounded text-[15px] transition-colors',
        isSelected
          ? 'bg-accent-primary/15 text-accent-secondary'
          : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
      )}
    >
      {icon && <span className="text-text-muted text-[13px]">{icon}</span>}
      <span>{label}</span>
    </button>
  )
}

interface ComparisonResultTypeNodeProps {
  label: string
  directions: string[]
  isExpanded: boolean
  onToggle: () => void
  onSelectDirection: (direction: string) => void
  isSelected: (direction: string) => boolean
}

export function ComparisonResultTypeNode({
  label,
  directions,
  isExpanded,
  onToggle,
  onSelectDirection,
  isSelected,
}: ComparisonResultTypeNodeProps) {
  return (
    <div className="tree-result-type">
      <button
        onClick={onToggle}
        className="tree-item w-full text-left flex items-center gap-1 py-1 px-2 rounded hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-[13px]">{ICONS.resultType}</span>
        <span className="text-text-secondary text-[15px]">{label}</span>
      </button>
      {isExpanded && (
        <div className="tree-children ml-4">
          {directions.map((direction, index) => (
            <button
              key={direction}
              onClick={() => onSelectDirection(direction)}
              className={clsx(
                'tree-item tree-leaf w-full text-left py-1 px-2 rounded text-[15px] transition-colors',
                isSelected(direction)
                  ? 'bg-accent-primary/15 text-accent-secondary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              )}
            >
              {index < directions.length - 1 ? ICONS.branch : ICONS.branchLast} {direction} Direction
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
