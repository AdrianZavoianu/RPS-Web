import { describe, expect, it } from 'vitest'

import { queryKeys } from '../src/hooks/queryKeys'

describe('queryKeys', () => {
  it('normalizes params into stable sorted keys', () => {
    const first = queryKeys.globalResults('proj-a', {
      b: 2,
      a: 1,
      nested: { z: 3, y: undefined, x: 2 },
      tags: ['one', undefined, 'two'],
      optional: undefined,
    })

    const second = queryKeys.globalResults('proj-a', {
      tags: ['one', 'two'],
      nested: { x: 2, z: 3 },
      a: 1,
      b: 2,
    })

    expect(first).toEqual(second)
    expect(first).toEqual([
      'globalResults',
      'proj-a',
      {
        a: 1,
        b: 2,
        nested: { x: 2, z: 3 },
        tags: ['one', 'two'],
      },
    ])
  })

  it('drops nullish args from scoped keys', () => {
    expect(queryKeys.exportJob('proj-a', null)).toEqual(['exportJob', 'proj-a'])
    expect(queryKeys.resultTreeMetadata('proj-a', undefined)).toEqual([
      'resultTreeMetadata',
      'proj-a',
    ])
  })
})

