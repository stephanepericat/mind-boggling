import { z } from 'zod'

export const chatSendSchema = z.object({
  type: z.literal('chat.send'),
  idempotencyKey: z.string().min(8).max(100),
  text: z.string().trim().min(1).max(500)
})

export type ChatSendCommand = z.infer<typeof chatSendSchema>

export interface ChatMessage {
  id: string
  memberId: string
  displayName: string
  text: string
  sentAt: number
}
