import { z } from 'zod'

const idempotencyKey = z.string().min(8).max(100)
const color = z.enum(['red', 'yellow', 'green', 'blue'])

export const unoSettingsSchema = z.object({
  rulesVersion: z.literal('classic-108.v1').default('classic-108.v1'),
  targetScore: z.union([z.literal(250), z.literal(500), z.literal(1000)]).default(500),
  locale: z.literal('en-US').default('en-US')
})

export const unoCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('uno.card.play'),
    idempotencyKey,
    cardId: z.string().min(1).max(100),
    declaredColor: color.optional(),
    calledUno: z.boolean().default(false)
  }),
  z.object({ type: z.literal('uno.card.draw'), idempotencyKey }),
  z.object({ type: z.literal('uno.turn.pass'), idempotencyKey }),
  z.object({ type: z.literal('uno.color.choose'), idempotencyKey, color }),
  z.object({ type: z.literal('uno.call'), idempotencyKey }),
  z.object({ type: z.literal('uno.catch'), idempotencyKey }),
  z.object({
    type: z.literal('uno.wild-draw-four.respond'),
    idempotencyKey,
    response: z.enum(['accept', 'challenge'])
  }),
  z.object({ type: z.literal('uno.round.continue'), idempotencyKey }),
  z.object({
    type: z.literal('uno.turn.resolve-disconnect'),
    idempotencyKey,
    memberId: z.string().min(1).max(100)
  })
])

export type UnoCommand = z.infer<typeof unoCommandSchema>
