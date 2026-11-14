import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(80),
  email: z.string().trim().email('E-mail inválido').max(254),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(72),
})

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(254),
  password: z.string().min(1, 'Informe sua senha').max(72),
})
