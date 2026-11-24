import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'

export async function ensureProductExists(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new HttpError(404, 'Produto não encontrado')
}
