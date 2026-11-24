import { z } from 'zod'

export const priceSchema = z
  .number()
  .positive('O preço deve ser maior que zero')
  .max(99_999_999.99, 'O preço máximo é 99.999.999,99')
  .refine((value) => Number(value.toFixed(2)) === value, 'O preço deve ter no máximo duas casas decimais')
