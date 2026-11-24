import type { Request, Response } from 'express'
import { getMe } from '../service/get-me.service'

export async function getMeController(req: Request, res: Response) {
  res.status(200).json({ user: await getMe(req.userId!) })
}
