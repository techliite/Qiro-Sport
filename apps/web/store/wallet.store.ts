import { create } from 'zustand'

interface WalletStore {
  balanceKobo: number
  setBalance: (kobo: number) => void
}

export const useWalletStore = create<WalletStore>((set) => ({
  balanceKobo: 0,
  setBalance: (kobo) => set({ balanceKobo: kobo }),
}))
