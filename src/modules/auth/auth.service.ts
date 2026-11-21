import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { HttpError } from '../../shared/http-error'
import { prisma } from '../../shared/prisma'

type Credentials = { email: string; password: string }
type UserRole = 'USER' | 'ADMIN' | 'MODERATOR'

function createToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

function toPublicUser(user: { id: string; name: string; email: string; role: UserRole; createdAt: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}

export const authService = {
  async register(input: Credentials & { name: string }) {
    const email = input.email.toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new HttpError(409, 'Este e-mail já está cadastrado')

    const passwordHash = await bcrypt.hash(input.password, 12)
    const user = await prisma.user.create({
      data: { name: input.name, email, passwordHash },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return { user: toPublicUser(user), token: createToken(user.id) }
  },

  async login(input: Credentials) {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, 'E-mail ou senha inválidos')
    }
    return {
      user: toPublicUser(user),
      token: createToken(user.id),
    }
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    if (!user) throw new HttpError(404, 'Usuário não encontrado')
    return toPublicUser(user)
  },
}
