import { prisma } from '../../../shared/prisma'
import { ensureProductExists } from './product.helpers'
import type { updateProductSchema } from '../schemas/update-product.schema'

type UpdateProductInput = typeof updateProductSchema._output

export async function updateProduct(productId: string, input: UpdateProductInput) {
  await ensureProductExists(productId)
  const product = await prisma.product.update({
    where: { id: productId },
    data: input,
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
