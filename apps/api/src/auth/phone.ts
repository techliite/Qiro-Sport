// One canonical form for Nigerian numbers: +234XXXXXXXXXX.
// Without this, "0805…" and "+234805…" are different strings — a user who registers
// with one format can't log in with the other, and could even register twice.
export function normalizeNgPhone(input: unknown): unknown {
  if (typeof input !== 'string') return input
  const compact = input.replace(/[\s\-().]/g, '')

  if (/^\+234\d{10}$/.test(compact)) return compact
  if (/^234\d{10}$/.test(compact)) return `+${compact}`
  if (/^0\d{10}$/.test(compact)) return `+234${compact.slice(1)}`
  return compact // anything else is left for @IsPhoneNumber to reject
}
