import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format kobo amount to NGN display string. e.g. 150000 → "₦1,500.00" */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira)
}

/** Format odds to 2 decimal places. e.g. 2.5 → "2.50" */
export function formatOdds(odds: number): string {
  return odds.toFixed(2)
}
