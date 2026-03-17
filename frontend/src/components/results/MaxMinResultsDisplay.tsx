/**
 * MaxMin Results Display — shared component for Plots/Tables tabs.
 * Used by both the tree browser (ResultsView) and standalone MaxMinView.
 */

import clsx from 'clsx'
import { useMemo, useState } from 'react'
import type { MaxMinDataset } from '../../types'
import { PlotsTab } from './maxmin/PlotsTab'
import { TablesTab } from './maxmin/TablesTab'

export interface MaxMinResultsDisplayProps {
  data: MaxMinDataset
  resultType: string
}

type TabId = 'plots' | 'tables'

export function MaxMinResultsDisplay({
  data,
  resultType,
}: MaxMinResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState<TabId>('plots')
  const directions = data.directions || ['X', 'Y']

  // Extract unique load cases from OrigMax_ column keys
  const loadCases = useMemo(() => {
    const lcSet = new Set<string>()
    if (data.rows.length > 0 && directions.length > 0) {
      const row = data.rows[0]
      const dirPattern = directions.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
      const regex = new RegExp(`^OrigMax_(.+)_(${dirPattern})$`)
      for (const key of Object.keys(row)) {
        const match = key.match(regex)
        if (match) {
          lcSet.add(match[1])
        }
      }
    }
    return Array.from(lcSet).sort()
  }, [data.rows, directions])

  const unit = useMemo(() => data.meta?.unit || '', [data.meta?.unit])
  const decimals = useMemo(
    () => (typeof data.meta?.decimals === 'number' ? data.meta.decimals : null),
    [data.meta?.decimals]
  )

  const fmt = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '-'
    if (decimals === null) return String(v)
    return v.toFixed(decimals)
  }

  return (
    <div className="maxmin-display flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="maxmin-tabs flex gap-0">
        {(['plots', 'tables'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'maxmin-tab px-4 py-1.5 text-base capitalize transition-colors',
              activeTab === tab
                ? 'maxmin-tab-active text-accent-primary border-b-2 border-accent-primary font-medium'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'plots' ? (
        <PlotsTab
          data={data}
          directions={directions}
          loadCases={loadCases}
          resultType={resultType}
          unit={unit}
          decimals={decimals}
        />
      ) : (
        <TablesTab
          data={data}
          directions={directions}
          loadCases={loadCases}
          resultType={resultType}
          unit={unit}
          fmt={fmt}
        />
      )}
    </div>
  )
}
