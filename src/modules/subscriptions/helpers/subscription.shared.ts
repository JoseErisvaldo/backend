import { createHmac, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'

export function providerJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function verifySubscriptionWebhookSignature(
  resourceId: string,
  requestId: string | undefined,
  signature: string | undefined,
  secret: string | undefined,
) {
  if (!secret || !requestId || !signature) return false
  const fields = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key, value.join('=')]
    }),
  )
  if (!fields.ts || !fields.v1) return false
  const manifest = `id:${resourceId.toLowerCase()};request-id:${requestId};ts:${fields.ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  const received = Buffer.from(fields.v1, 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export function getProviderDate(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
