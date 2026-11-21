import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { env } from '../../config/env'
import { asyncHandler } from '../../shared/async-handler'
import { HttpError } from '../../shared/http-error'
import { prisma } from '../../shared/prisma'

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

export function ensureRoles(...allowedRoles: Role[]) {
  return asyncHandler(async (req, _res, next) => {
    if (!req.userId) throw new HttpError(401, 'Autenticação necessária')

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    })
    if (!user) throw new HttpError(401, 'Usuário não encontrado')
    if (!allowedRoles.includes(user.role)) {
      throw new HttpError(403, 'Você não tem permissão para executar esta ação')
    }

    next()
  })
}
