import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { toPublicUser } from './auth.helpers'

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  if (!user) throw new HttpError(404, 'Usuário não encontrado')
  return toPublicUser(user)
}
