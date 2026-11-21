import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(120),
  description: z.string().trim().min(1, 'Informe uma descrição').max(2000),
  price: z
    .number()
    .positive('O preço deve ser maior que zero')
    .max(99_999_999.99, 'O preço máximo é 99.999.999,99')
    .refine((value) => Number(value.toFixed(2)) === value, 'O preço deve ter no máximo duas casas decimais'),
  currency: z.string().trim().length(3).toUpperCase().default('BRL'),
  active: z.boolean().default(true),
}).strict()

export const listAdminProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'description', 'price']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).strict()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type ListAdminProductsQuery = z.infer<typeof listAdminProductsQuerySchema>
