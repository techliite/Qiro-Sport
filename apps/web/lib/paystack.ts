import { api } from '@/lib/api'

const INLINE_V2 = 'https://js.paystack.co/v2/inline.js'
let scriptPromise: Promise<void> | null = null

function loadInline(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Paystack needs a browser'))
  if (window.PaystackPop) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = INLINE_V2
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load Paystack. Check your connection.')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export type DepositResult =
  | { status: 'success'; balanceKobo: number }
  | { status: 'cancelled' }

/**
 * Full deposit flow: the API initialises the transaction (amount, email, userId metadata),
 * Paystack's popup resumes it by access code, then the API verifies and credits the wallet.
 * The webhook credits too — both use the reference as an idempotency key, so it's paid once.
 */
export async function depositWithPaystack(amountKobo: number): Promise<DepositResult> {
  const [init] = await Promise.all([
    api.post<{ reference: string; accessCode: string }>('/wallet/deposit/initialize', { amountKobo }),
    loadInline(),
  ])
  const { accessCode } = init.data
  if (!window.PaystackPop) throw new Error('Could not load Paystack. Please refresh and try again.')

  const reference = await new Promise<string | null>((resolve, reject) => {
    new window.PaystackPop!().resumeTransaction(accessCode, {
      onSuccess: (tx) => resolve(tx.reference),
      onCancel: () => resolve(null),
      onError: (e) => reject(new Error(e?.message ?? 'Payment failed')),
    })
  })
  if (!reference) return { status: 'cancelled' }

  const vr = await api.post<{ newBalanceKobo?: number; balanceKobo?: { balanceKobo: number } }>(
    '/wallet/deposit/verify',
    { reference },
  )
  const balanceKobo = vr.data.newBalanceKobo ?? vr.data.balanceKobo?.balanceKobo ?? 0
  return { status: 'success', balanceKobo }
}
