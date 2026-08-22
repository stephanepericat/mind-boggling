import type { z } from 'zod'
import { boggleCommandSchema } from '../games/boggle/schema'
import { farkleCommandSchema } from '../games/farkle/schema'
import { platformMatchCommandSchema } from './match'

export const matchCommandSchema = platformMatchCommandSchema.or(boggleCommandSchema).or(farkleCommandSchema)
export type MatchCommand = z.infer<typeof matchCommandSchema>
