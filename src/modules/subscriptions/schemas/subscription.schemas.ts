import { z } from 'zod'

export const planIdSchema = z.string().uuid()
const dateOnlySchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
})

export const planInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  tier: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED']),
  recurrence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  amount: z.number().positive().max(999999.99),
  active: z.boolean().default(true),
})

export const adminPlansQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'tier', 'recurrence', 'amount', 'active', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().trim().min(1).max(100).optional(),
  tier: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED']).optional(),
  recurrence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  active: z.enum(['true', 'false']).optional(),
}).strict()

export const adminSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['customer', 'email', 'plan', 'status', 'nextPaymentDate', 'createdAt', 'amount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  tier: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED']).optional(),
  recurrence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  createdAtFrom: dateOnlySchema.optional(),
  createdAtTo: dateOnlySchema.optional(),
  nextPaymentDateFrom: dateOnlySchema.optional(),
  nextPaymentDateTo: dateOnlySchema.optional(),
}).strict().superRefine((query, context) => {
  const dateRanges = [
    { from: query.createdAtFrom, to: query.createdAtTo, label: 'Data da assinatura' },
    { from: query.nextPaymentDateFrom, to: query.nextPaymentDateTo, label: 'Data da próxima cobrança' },
  ]
  for (const range of dateRanges) {
    if (range.from && range.to && range.from > range.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${range.label}: a data inicial deve ser anterior ou igual à data final.`,
      })
    }
  }
})

export const createSubscriptionSchema = z.object({
  planId: planIdSchema,
  cardToken: z.string().trim().min(1).max(500),
})

export const subscriptionWebhookSchema = z.object({
  type: z.string().optional(),
  topic: z.string().optional(),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
  id: z.union([z.string(), z.number()]).optional(),
})

export const subscriptionIdSchema = z.string().uuid()
