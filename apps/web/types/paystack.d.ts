interface PaystackPopOptions {
  key: string
  email: string
  amount: number
  ref?: string
  accessCode?: string
  currency?: string
  metadata?: Record<string, unknown>
  onSuccess: (transaction: { reference: string; status: string }) => void
  onCancel: () => void
}

interface PaystackPopInstance {
  openIframe(): void
}

interface PaystackPopConstructor {
  setup(options: PaystackPopOptions): PaystackPopInstance
  new (): {
    newTransaction(options: PaystackPopOptions): void
  }
}

interface Window {
  PaystackPop: PaystackPopConstructor
}
