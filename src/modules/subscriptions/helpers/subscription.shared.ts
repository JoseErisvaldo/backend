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

const brazilianDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function getCalendarDate(date: Date) {
  const parts = brazilianDateParts.formatToParts(date)
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}

export function getRemainingChargeTime(nextPaymentDate: Date | null) {
  if (!nextPaymentDate) return null
  const today = getCalendarDate(new Date())
  const dueDate = getCalendarDate(nextPaymentDate)
  const todayEpoch = Date.UTC(today.year, today.month - 1, today.day)
  const dueEpoch = Date.UTC(dueDate.year, dueDate.month - 1, dueDate.day)
  const totalDays = Math.floor((dueEpoch - todayEpoch) / 86_400_000)
  if (totalDays < 0) return 'A data prevista para cobrança já passou'
  if (totalDays === 0) return 'Cobrança prevista para hoje'

  const dateAfterMonths = (monthsToAdd: number) => {
    const absoluteMonth = today.year * 12 + today.month - 1 + monthsToAdd
    const year = Math.floor(absoluteMonth / 12)
    const month = absoluteMonth % 12 + 1
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return Date.UTC(year, month - 1, Math.min(today.day, lastDayOfMonth))
  }
  let totalMonths = (dueDate.year - today.year) * 12 + dueDate.month - today.month
  if (dateAfterMonths(totalMonths) > dueEpoch) totalMonths -= 1
  const remainingDays = Math.floor((dueEpoch - dateAfterMonths(totalMonths)) / 86_400_000)
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const duration = [
    years ? `${years} ${years === 1 ? 'ano' : 'anos'}` : '',
    months ? `${months} ${months === 1 ? 'mês' : 'meses'}` : '',
    remainingDays ? `${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'}` : '',
  ].filter(Boolean).join(', ')

  return `Faltam ${duration} (${totalDays} ${totalDays === 1 ? 'dia' : 'dias'} no total)`
}
