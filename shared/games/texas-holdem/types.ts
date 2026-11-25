export type HoldemFormat = 'fixed-hands' | 'tournament'
export type HoldemStreet = 'preflop' | 'flop' | 'turn' | 'river'
export type HoldemAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'
export type HoldemRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'
export type HoldemSuit = 'c' | 'd' | 'h' | 's'
export type HoldemCard = `${HoldemRank}${HoldemSuit}`

export interface HoldemSettings {
  rulesVersion: 'no-limit.v1'
  format: HoldemFormat
  locale: 'en-US'
}

export interface HoldemSeat {
  memberId: string
  stack: number
  placement?: number
}

export interface HoldemHandPlayer {
  memberId: string
  cards: HoldemCard[]
  openingStack: number
  streetChips: number
  totalChips: number
  folded: boolean
  lastFaced: number | null
}

export interface HoldemTurn {
  id: number
  memberId: string
  deadline: number
}

export interface HoldemHand {
  number: number
  button: number
  smallBlindSeat: number
  bigBlindSeat: number
  smallBlind: number
  bigBlind: number
  street: HoldemStreet
  deck: HoldemCard[]
  cursor: number
  board: HoldemCard[]
  players: HoldemHandPlayer[]
  wager: number
  fullRaise: number
  turn?: HoldemTurn
  decisions: number
}

export interface HoldemAward {
  amount: number
  payouts: Array<{ memberId: string, chips: number }>
}

export interface HoldemHandResult {
  handNumber: number
  board: HoldemCard[]
  awards: HoldemAward[]
  refunds: Array<{ memberId: string, chips: number }>
  showdown: Array<{ memberId: string, cards: HoldemCard[], bestFive: HoldemCard[], label: string }>
}

export interface HoldemState {
  seats: HoldemSeat[]
  hand: HoldemHand
  completedHands: number
  latestResult?: HoldemHandResult
  nextDealAt?: number
  finishedAt?: number
}

export interface HoldemLegalActions {
  check: boolean
  call: number
  fold: boolean
  allIn: boolean
  wager?: { action: 'bet' | 'raise', min: number, max: number }
}

export interface HoldemPlayerView {
  handNumber: number
  completedHands: number
  street?: HoldemStreet
  board: HoldemCard[]
  cards: HoldemCard[]
  seats: Array<HoldemSeat & {
    button: boolean
    smallBlind: boolean
    bigBlind: boolean
    commitment: number
    status: 'playing' | 'folded' | 'all-in' | 'out'
  }>
  pots: number[]
  blinds: { small: number, big: number, handsUntilIncrease?: number }
  turn?: HoldemTurn
  actions?: HoldemLegalActions
  latestResult?: HoldemHandResult
  nextDealAt?: number
}

export interface HoldemDecision {
  handNumber: number
  turnId: number
  action: HoldemAction
  amount?: number
}
