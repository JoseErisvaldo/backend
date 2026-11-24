import jwt from 'jsonwebtoken'
import { env } from '../../../config/env'

type UserRole = 'USER' | 'ADMIN' | 'MODERATOR'

export function createToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function toPublicUser(user: {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: Date
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}
