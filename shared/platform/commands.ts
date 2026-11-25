import type { z } from 'zod'
import { boggleCommandSchema } from '../games/boggle/schema'
import { farkleCommandSchema } from '../games/farkle/schema'
import { holdemCommandSchema } from '../games/texas-holdem/schema'
import { unoCommandSchema } from '../games/uno/schema'
import { platformMatchCommandSchema } from './match'

export const matchCommandSchema = platformMatchCommandSchema.or(boggleCommandSchema).or(farkleCommandSchema).or(unoCommandSchema).or(holdemCommandSchema)
export type MatchCommand = z.infer<typeof matchCommandSchema>
