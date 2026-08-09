function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function createOpaqueToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

export async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return `${value}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifySignedValue(signed: string, secret: string): Promise<string | null> {
  const separator = signed.lastIndexOf('.')
  if (separator < 1) return null
  const value = signed.slice(0, separator)
  const expected = await signValue(value, secret)
  if (signed.length !== expected.length) return null
  let difference = 0
  for (let index = 0; index < signed.length; index += 1) {
    difference |= signed.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return difference === 0 ? value : null
}
