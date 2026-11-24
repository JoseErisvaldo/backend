import { z } from 'zod'

export const listAdminProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'description', 'price']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).strict()
