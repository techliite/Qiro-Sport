import { normalizeNgPhone } from './phone'

describe('normalizeNgPhone', () => {
  it.each([
    ['08059472483', '+2348059472483'],
    ['+2348059472483', '+2348059472483'],
    ['2348059472483', '+2348059472483'],
    ['0805 947 2483', '+2348059472483'],
    ['0805-947-2483', '+2348059472483'],
    ['+234 805 947 2483', '+2348059472483'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeNgPhone(input)).toBe(expected)
  })

  it('leaves non-Nigerian or malformed input for validation to reject', () => {
    expect(normalizeNgPhone('12345')).toBe('12345')
    expect(normalizeNgPhone('+447911123456')).toBe('+447911123456')
  })

  it('passes non-strings through untouched', () => {
    expect(normalizeNgPhone(undefined)).toBeUndefined()
    expect(normalizeNgPhone(8059472483)).toBe(8059472483)
  })
})
