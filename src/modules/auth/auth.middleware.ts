import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { HttpError } from '../../shared/http-error'

export function ensureAuthenticated(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Autenticação necessária'))
  }

  try {
    const payload = jwt.verify(authorization.slice(7), env.JWT_SECRET)
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token subject')
    req.userId = payload.sub
    next()
  } catch {
    next(new HttpError(401, 'Token inválido ou expirado'))
  }
}
