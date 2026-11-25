import { z } from 'zod'
import { HOLDEM_RULES } from './rules'

export const holdemSettingsSchema = z.object({
  rulesVersion: z.literal(HOLDEM_RULES.version).default(HOLDEM_RULES.version),
  format: z.enum(['fixed-hands', 'tournament']),
  locale: z.literal('en-US').default('en-US')
})

export const holdemCommandSchema = z.object({
  type: z.literal('texas-holdem.act'),
  idempotencyKey: z.string().min(8).max(100),
  handNumber: z.number().int().positive(),
  turnId: z.number().int().positive(),
  action: z.enum(['fold', 'check', 'call', 'bet', 'raise', 'all-in']),
  amount: z.number().int().positive().max(8000).optional()
})

export type HoldemCommand = z.infer<typeof holdemCommandSchema>
