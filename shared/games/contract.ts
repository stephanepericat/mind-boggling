import type { StandardSchemaV1 } from '@standard-schema/spec'

export type GameKey = `${string}.v${number}`

export interface GameManifest {
  key: GameKey
  slug: string
  name: string
  description: string
  version: number
  minPlayers: number
  maxPlayers: number
  locales: readonly string[]
  capabilities: {
    rounds: boolean
    simultaneousPlay: boolean
    cumulativeScoring: boolean
    spectators: boolean
  }
}

export interface ViewerContext {
  memberId: string
  role: 'host' | 'player'
}

export interface CommandContext<State, Command> {
  state: State
  command: Command
  actorMemberId: string
  now: number
}

export interface ScoreboardEntry<Score = number> {
  memberId: string
  displayName: string
  score: Score
  rank: number
}

export interface GameDefinition<Settings, State, Command, Event, PlayerView> {
  manifest: GameManifest
  settingsSchema: StandardSchemaV1<Settings>
  commandSchema: StandardSchemaV1<Command>
  createInitialState(settings: Settings): State
  decide(context: CommandContext<State, Command>): Event[]
  evolve(state: State, event: Event): State
  project(state: State, viewer: ViewerContext): PlayerView
}
