import { describe, expect, it } from 'vitest'
import { chatSendSchema } from '../shared/platform/chat'

describe('chat messages', () => {
  it('trims and accepts a valid platform chat message', () => {
    expect(chatSendSchema.parse({
      type: 'chat.send',
      idempotencyKey: 'chat-message-1',
      text: '  Good luck!  '
    })).toEqual({
      type: 'chat.send',
      idempotencyKey: 'chat-message-1',
      text: 'Good luck!'
    })
  })

  it('rejects blank and oversized messages', () => {
    expect(() => chatSendSchema.parse({
      type: 'chat.send',
      idempotencyKey: 'chat-message-2',
      text: '   '
    })).toThrow()
    expect(() => chatSendSchema.parse({
      type: 'chat.send',
      idempotencyKey: 'chat-message-3',
      text: 'a'.repeat(501)
    })).toThrow()
  })
})
