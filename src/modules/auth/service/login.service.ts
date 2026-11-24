import bcrypt from 'bcryptjs'
import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { createToken, toPublicUser } from './auth.helpers'
import type { loginSchema } from '../schemas/login.schema'

type LoginInput = typeof loginSchema._output

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, 'E-mail ou senha inválidos')
  }
  return {
    user: toPublicUser(user),
    token: createToken(user.id),
  }
}
