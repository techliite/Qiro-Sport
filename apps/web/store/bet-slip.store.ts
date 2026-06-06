import { create } from 'zustand'
import type { BetSelection } from '@qiro/types'

interface BetSlipStore {
  selections: BetSelection[]
  stakeKobo: number
  isOpen: boolean

  addSelection: (sel: BetSelection) => void
  removeSelection: (fixtureId: string, market: string) => void
  clearSelections: () => void
  setStake: (kobo: number) => void
  toggleSlip: () => void

  potentialWinKobo: () => number
}

export const useBetSlipStore = create<BetSlipStore>((set, get) => ({
  selections: [],
  stakeKobo: 0,
  isOpen: false,

  addSelection: (sel) => {
    set((state) => {
      // Replace if same fixture+market already in slip
      const filtered = state.selections.filter(
        (s) => !(s.fixtureId === sel.fixtureId && s.market === sel.market),
      )
      return { selections: [...filtered, sel], isOpen: true }
    })
  },

  removeSelection: (fixtureId, market) => {
    set((state) => ({
      selections: state.selections.filter(
        (s) => !(s.fixtureId === fixtureId && s.market === market),
      ),
    }))
  },

  clearSelections: () => set({ selections: [], stakeKobo: 0 }),

  setStake: (kobo) => set({ stakeKobo: kobo }),

  toggleSlip: () => set((s) => ({ isOpen: !s.isOpen })),

  potentialWinKobo: () => {
    const { selections, stakeKobo } = get()
    if (selections.length === 0 || stakeKobo === 0) return 0
    const totalOdds = selections.reduce((acc, s) => acc * s.oddsDecimal, 1)
    return Math.floor(stakeKobo * totalOdds)
  },
}))
