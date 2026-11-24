import { z } from 'zod'

export const mercadoPagoOrderSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().optional(),
  processing_mode: z.string().optional(),
  status: z.string().optional(),
  status_detail: z.string().optional(),
  external_reference: z.string().optional(),
  last_updated_date: z.string().optional(),
  currency: z.string().optional(),
  capture_mode: z.string().optional(),
  country_code: z.string().optional(),
  created_date: z.string().optional(),
  total_amount: z.union([z.string(), z.number()]).optional(),
  total_paid_amount: z.union([z.string(), z.number()]).optional(),
  transactions: z.object({
    payments: z.array(z.object({
      id: z.union([z.string(), z.number()]).optional(),
      amount: z.union([z.string(), z.number()]).optional(),
      status: z.string().optional(),
      status_detail: z.string().optional(),
      reference_id: z.string().optional(),
      expiration_time: z.string().optional(),
      date_of_expiration: z.string().optional(),
      payment_method: z.object({
        id: z.string().optional(),
        type: z.string().optional(),
        installments: z.number().int().positive().optional(),
        installment_amount: z.union([z.string(), z.number()]).optional(),
        qr_code: z.string().optional(),
        qr_code_base64: z.string().optional(),
        ticket_url: z.string().optional(),
      }).passthrough(),
    }).passthrough()),
  }).optional(),
}).passthrough()

export type MercadoPagoOrder = z.infer<typeof mercadoPagoOrderSchema>

export const mercadoPagoErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  cause: z.array(z.object({
    code: z.union([z.string(), z.number()]).optional(),
  }).passthrough()).optional(),
}).passthrough()
