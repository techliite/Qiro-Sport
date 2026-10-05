// Paystack Inline JS v2 — https://paystack.com/docs/developer-tools/inlinejs/
interface PaystackTransaction {
  reference: string
  status?: string
  message?: string
}

interface PaystackCallbacks {
  onSuccess?: (transaction: PaystackTransaction) => void
  onCancel?: () => void
  onError?: (error: { message?: string }) => void
}

interface PaystackPopV2 {
  // Opens checkout for a transaction the API already initialised (no duplicate reference)
  resumeTransaction(accessCode: string, callbacks?: PaystackCallbacks): void
}

interface Window {
  PaystackPop?: new () => PaystackPopV2
}
