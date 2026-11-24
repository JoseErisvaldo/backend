import type { Request, Response } from 'express'
import { login } from '../service/login.service'
import { loginSchema } from '../schemas/login.schema'

export async function loginController(req: Request, res: Response) {
  const input = loginSchema.parse(req.body)
  res.status(200).json(await login(input))
}
