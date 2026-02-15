import { useState } from 'react'
import clsx from 'clsx'
import { useResultSets, useAvailableResultTypes, useCreateComparisonSet } from '../../hooks/useResults'
import type { ComparisonSetCreate } from '../../types'

interface ComparisonSetDialogProps {
  projectSlug: string
  onClose: () => void
  onCreated?: () => void
}

// Mapping from result type to display category
const GLOBAL_TYPES = ['Drifts', 'Accelerations', 'Forces', 'Displacements']
const ELEMENT_TYPES = ['WallShears', 'QuadRotations', 'ColumnShears', 'ColumnAxials', 'ColumnRotations', 'BeamRotations']
const JOINT_TYPES = ['SoilPressures', 'VerticalDisplacements']

const DISPLAY_NAMES: Record<string, string> = {
  WallShears: 'Wall Shears',
  QuadRotations: 'Quad Rotations',
  ColumnShears: 'Column Shears',
  ColumnAxials: 'Column Axials',
  ColumnRotations: 'Column Rotations',
  BeamRotations: 'Beam Rotations',
  SoilPressures: 'Soil Pressures',
  VerticalDisplacements: 'Vertical Displacements',
}

export function ComparisonSetDialog({ projectSlug, onClose, onCreated }: ComparisonSetDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedResultSetIds, setSelectedResultSetIds] = useState<Set<number>>(new Set())
  const [selectedResultTypes, setSelectedResultTypes] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const { data: resultSets } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)
  const createMutation = useCreateComparisonSet(projectSlug)

  // Filter to only types that exist in the project
  const availableGlobal = GLOBAL_TYPES.filter(
    (t) => availableTypes?.global_results.some((r) => r.type === t)
  )
  const availableElement = ELEMENT_TYPES.filter(
    (t) => availableTypes?.element_results.some((r) => r.type === t)
  )
  const availableJoint = JOINT_TYPES.filter(
    (t) => availableTypes?.joint_results.some((r) => r.type === t)
  )
  const allAvailableTypes = [...availableGlobal, ...availableElement, ...availableJoint]

  const toggleResultSet = (id: number) => {
    setSelectedResultSetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleResultType = (type: string) => {
    setSelectedResultTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const selectAllResultSets = () => {
    if (!resultSets) return
    // Only NLTHA result sets for comparison
    const nltha = resultSets.filter((rs) => rs.analysis_type !== 'Pushover')
    setSelectedResultSetIds(new Set(nltha.map((rs) => rs.id)))
  }

  const selectNoneResultSets = () => setSelectedResultSetIds(new Set())

  const selectAllTypes = () => setSelectedResultTypes(new Set(allAvailableTypes))
  const selectNoneTypes = () => setSelectedResultTypes(new Set())

  const canCreate = name.trim() && selectedResultSetIds.size >= 2 && selectedResultTypes.size > 0

  const handleCreate = () => {
    if (!canCreate) return
    setError(null)

    const data: ComparisonSetCreate = {
      name: name.trim(),
      description: description.trim(),
      result_set_ids: Array.from(selectedResultSetIds),
      result_types: Array.from(selectedResultTypes),
    }

    createMutation.mutate(data, {
      onSuccess: () => {
        onCreated?.()
        onClose()
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to create comparison set')
      },
    })
  }

  const nlthaResultSets = resultSets?.filter((rs) => rs.analysis_type !== 'Pushover') || []

  return (
    <div className="dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="comparison-dialog-content bg-bg-primary border border-border-default rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="dialog-header flex items-center justify-between px-5 py-3 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">Create Comparison Set</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="dialog-body flex-1 overflow-auto px-5 py-4 space-y-4">
          {/* Name & Description */}
          <div className="comparison-dialog-inputs flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-text-secondary mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. COM1"
                className="input w-full px-3 py-1.5 bg-bg-secondary border border-border-default rounded text-sm text-text-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-text-secondary mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="input w-full px-3 py-1.5 bg-bg-secondary border border-border-default rounded text-sm text-text-primary"
              />
            </div>
          </div>

          {/* Main selection area */}
          <div className="comparison-dialog-selection flex gap-4">
            {/* Result Sets */}
            <div className="comparison-dialog-sets flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">
                  Result Sets <span className="text-text-muted">(min 2)</span>
                </label>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={selectAllResultSets} className="text-accent-primary hover:underline">All</button>
                  <button type="button" onClick={selectNoneResultSets} className="text-accent-primary hover:underline">None</button>
                </div>
              </div>
              <div className="comparison-dialog-list border border-border-default rounded bg-bg-secondary p-2 max-h-[200px] overflow-auto space-y-1">
                {nlthaResultSets.length === 0 ? (
                  <div className="text-sm text-text-muted py-2 text-center">No result sets</div>
                ) : (
                  nlthaResultSets.map((rs) => (
                    <label
                      key={rs.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-hover cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedResultSetIds.has(rs.id)}
                        onChange={() => toggleResultSet(rs.id)}
                        className="w-3.5 h-3.5 rounded border-border-default"
                      />
                      <span className="text-sm text-text-primary">{rs.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Result Types - 3 columns */}
            <div className="comparison-dialog-types flex-[2]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">Result Types</label>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={selectAllTypes} className="text-accent-primary hover:underline">All</button>
                  <button type="button" onClick={selectNoneTypes} className="text-accent-primary hover:underline">None</button>
                </div>
              </div>
              <div className="comparison-dialog-type-grid border border-border-default rounded bg-bg-secondary p-2 max-h-[200px] overflow-auto">
                <div className="grid grid-cols-3 gap-x-4 gap-y-0">
                  {/* Global column */}
                  <div>
                    <div className="text-xs font-medium text-text-muted mb-1 uppercase">Global</div>
                    {availableGlobal.map((t) => (
                      <TypeCheckbox key={t} type={t} selected={selectedResultTypes.has(t)} onToggle={() => toggleResultType(t)} />
                    ))}
                  </div>
                  {/* Element column */}
                  <div>
                    <div className="text-xs font-medium text-text-muted mb-1 uppercase">Element</div>
                    {availableElement.map((t) => (
                      <TypeCheckbox key={t} type={t} selected={selectedResultTypes.has(t)} onToggle={() => toggleResultType(t)} />
                    ))}
                  </div>
                  {/* Joint column */}
                  <div>
                    <div className="text-xs font-medium text-text-muted mb-1 uppercase">Joint</div>
                    {availableJoint.map((t) => (
                      <TypeCheckbox key={t} type={t} selected={selectedResultTypes.has(t)} onToggle={() => toggleResultType(t)} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer flex items-center justify-end gap-3 px-5 py-3 border-t border-border-default">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-1.5 rounded text-sm bg-bg-secondary text-text-secondary hover:bg-bg-hover border border-border-default"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate || createMutation.isPending}
            className={clsx(
              'btn-primary px-4 py-1.5 rounded text-sm',
              canCreate && !createMutation.isPending
                ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
                : 'bg-bg-secondary text-text-muted cursor-not-allowed'
            )}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Comparison Set'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TypeCheckbox({
  type,
  selected,
  onToggle,
}: {
  type: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-bg-hover cursor-pointer">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-3.5 h-3.5 rounded border-border-default"
      />
      <span className="text-sm text-text-primary">{DISPLAY_NAMES[type] || type}</span>
    </label>
  )
}
