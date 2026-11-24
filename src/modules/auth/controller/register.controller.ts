import type { Request, Response } from 'express'
import { register } from '../service/register.service'
import { registerSchema } from '../schemas/register.schema'

export async function registerController(req: Request, res: Response) {
  const input = registerSchema.parse(req.body)
  res.status(201).json(await register(input))
}
