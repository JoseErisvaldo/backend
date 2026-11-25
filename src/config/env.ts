import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  MP_SUBSCRIPTIONS_BACK_URL: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === 'https:', 'MP_SUBSCRIPTIONS_BACK_URL precisa usar HTTPS'),
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_SUBSCRIPTIONS_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  MP_SUBSCRIPTIONS_WEBHOOK_SECRET: z.string().min(1),
  API_PUBLIC_URL: z.string().url(),
  MP_PIX_APPROVAL_TEST_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

export const env = envSchema.parse(process.env)

if (env.MP_PIX_APPROVAL_TEST_MODE && env.NODE_ENV === 'production') {
  throw new Error('MP_PIX_APPROVAL_TEST_MODE não pode ser habilitado em produção')
}
