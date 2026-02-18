import { describe, expect, it } from 'vitest'

import { buildQueryParams } from '../src/api/client'

describe('api client query params', () => {
  it('builds query strings with scalar and array values', () => {
    const query = buildQueryParams({
      result_set_id: 7,
      direction: 'X',
      include_summary: true,
      result_types: ['Drifts', 'Forces'],
    })

    expect(query).toBe(
      '?result_set_id=7&direction=X&include_summary=true&result_types=Drifts%2CForces'
    )
  })

  it('omits nullish values and empty arrays', () => {
    const query = buildQueryParams({
      a: undefined,
      b: null,
      c: [],
    })

    expect(query).toBe('')
  })

  it('encodes characters safely', () => {
    const query = buildQueryParams({
      load_case: 'TH 01 / X+',
      note: 'a&b',
    })

    expect(query).toBe('?load_case=TH+01+%2F+X%2B&note=a%26b')
  })
})

