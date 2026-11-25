import { z } from 'zod'

export const planIdSchema = z.string().uuid()

export const planInputSchema = z.object({
  tier: z.enum(['BASIC', 'SIMPLE', 'PRO']),
  recurrence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  amount: z.number().positive().max(999999.99),
  active: z.boolean().default(true),
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
