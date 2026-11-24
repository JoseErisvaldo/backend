import { z } from 'zod'

export const setProductActiveSchema = z.object({
  active: z.boolean(),
}).strict()
