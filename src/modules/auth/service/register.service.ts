import bcrypt from 'bcryptjs'
import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { createToken, toPublicUser } from './auth.helpers'
import type { registerSchema } from '../schemas/register.schema'

type RegisterInput = typeof registerSchema._output

export async function register(input: RegisterInput) {
  const email = input.email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new HttpError(409, 'Este e-mail já está cadastrado')

  const passwordHash = await bcrypt.hash(input.password, 12)
  const user = await prisma.user.create({
    data: { name: input.name, email, passwordHash },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  return { user: toPublicUser(user), token: createToken(user.id) }
}
