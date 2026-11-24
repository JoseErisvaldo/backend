import { prisma } from '../../../shared/prisma'
import type { createProductSchema } from '../schemas/create-product.schema'

type CreateProductInput = typeof createProductSchema._output

export async function createProduct(input: CreateProductInput) {
  const product = await prisma.product.create({
    data: input,
    select: { id: true, name: true, description: true, price: true, currency: true },
  })
  return { ...product, price: Number(product.price) }
}
