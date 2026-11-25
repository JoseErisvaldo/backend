import { z } from 'zod'

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
})

function getSaoPauloDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getPreviousMonthRange(today: string) {
  const [year, month] = today.split('-').map(Number)
  const currentMonthStart = new Date(Date.UTC(year, month - 1, 1))
  const previousMonthEnd = new Date(currentMonthStart)
  previousMonthEnd.setUTCDate(0)
  const previousMonthStart = new Date(Date.UTC(year, month - 2, 1))
  return {
    dateFrom: previousMonthStart.toISOString().slice(0, 10),
    dateTo: previousMonthEnd.toISOString().slice(0, 10),
  }
}

export const adminSubscriptionsDashboardQuerySchema = z.object({
  dateFrom: dateOnlySchema,
  dateTo: dateOnlySchema,
  comparison: z.enum(['true']).optional(),
  upcomingPage: z.coerce.number().int().min(1).default(1),
  upcomingPageSize: z.coerce.number().int().min(1).max(50).default(10),
}).refine((query) => query.dateFrom <= query.dateTo, {
  message: 'A data inicial deve ser anterior ou igual à data final.',
  path: ['dateTo'],
}).superRefine((query, context) => {
  const today = getSaoPauloDate(new Date())
  const earliestAllowedDate = new Date(`${today}T00:00:00.000Z`)
  earliestAllowedDate.setUTCDate(earliestAllowedDate.getUTCDate() - 29)
  const earliestAllowed = earliestAllowedDate.toISOString().slice(0, 10)
  const duration = (Date.parse(`${query.dateTo}T00:00:00.000Z`) - Date.parse(`${query.dateFrom}T00:00:00.000Z`)) / DAY_IN_MILLISECONDS + 1
  const isWithinLast30Days = query.dateFrom >= earliestAllowed
    && query.dateTo <= today
    && duration <= 30
  const previousMonth = getPreviousMonthRange(today)
  const isPreviousMonth = query.dateFrom === previousMonth.dateFrom
    && query.dateTo === previousMonth.dateTo
  const isBoundedComparison = query.comparison === 'true'
    && query.dateTo <= today
    && duration <= 30

  if (!isWithinLast30Days && !isPreviousMonth && !isBoundedComparison) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O período deve estar nos últimos 30 dias ou corresponder ao mês passado completo.',
      path: ['dateTo'],
    })
  }
})
