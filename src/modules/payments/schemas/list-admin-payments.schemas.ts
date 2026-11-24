import { z } from 'zod'
import { listPaymentsQuerySchema } from './list-user-payments.schemas'

export const listAdminPaymentsQuerySchema = listPaymentsQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  customerName: z.string().trim().max(120).optional(),
  paymentMethod: z.enum(['pix', 'card']).optional(),
  status: z.enum(['paid', 'pending', 'failed', 'cancelled', 'expired']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
  { message: 'A data inicial deve ser anterior ou igual à data final', path: ['dateTo'] },
)
