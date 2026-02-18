import { describe, expect, it } from 'vitest'

import { naturalCompare } from '../src/components/projects/results-tree/constants'
import { isComparisonSelection, isJointSelectionType, type TreeSelection } from '../src/components/projects/results-tree/types'

describe('results tree helpers', () => {
  it('sorts labels naturally with numeric awareness', () => {
    const names = ['L10', 'L2', 'L1']
    names.sort(naturalCompare)
    expect(names).toEqual(['L1', 'L2', 'L10'])
  })

  it('identifies comparison selections correctly', () => {
    const comparisonSelection = {
      type: 'comparison_global',
      resultSetId: 1,
      category: 'Envelopes',
      resultType: 'Drifts',
      direction: 'X',
      comparisonSetId: 7,
      comparisonSetName: 'Set-1',
      resultSetIds: [1, 2],
    } as TreeSelection

    const regularSelection = {
      type: 'global_result',
      resultSetId: 1,
      category: 'Envelopes',
      categoryType: 'Global',
      resultType: 'Drifts',
      direction: 'X',
    } as TreeSelection

    expect(isComparisonSelection(comparisonSelection)).toBe(true)
    expect(isComparisonSelection(regularSelection)).toBe(false)
    expect(isComparisonSelection(null)).toBe(false)
  })

  it('identifies joint selection types', () => {
    expect(isJointSelectionType('joint')).toBe(true)
    expect(isJointSelectionType('joint_plot')).toBe(true)
    expect(isJointSelectionType('joint_table')).toBe(true)
    expect(isJointSelectionType('global_result')).toBe(false)
  })
})

