import { prisma } from '../../../shared/prisma'
import { ensureProductExists } from './product.helpers'
import type { setProductActiveSchema } from '../schemas/set-product-active.schema'

type SetProductActiveInput = typeof setProductActiveSchema._output

export async function setProductActive(productId: string, input: SetProductActiveInput) {
  await ensureProductExists(productId)
  const product = await prisma.product.update({
    where: { id: productId },
    data: { active: input.active },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      currency: true,
      active: true,
      createdAt: true,
    },
  })
  return { ...product, price: Number(product.price) }
}
