import type { Request, Response } from 'express'
import { authService } from './auth.service'
import { loginSchema, registerSchema } from './auth.schemas'

export const authController = {
  async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body)
    const result = await authService.register(input)
    res.status(201).json(result)
  },

  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body)
    res.status(200).json(await authService.login(input))
  },

  async me(req: Request, res: Response) {
    res.status(200).json({ user: await authService.me(req.userId!) })
  },
}
