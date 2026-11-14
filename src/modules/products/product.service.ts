import { prisma } from '../../shared/prisma'

export const productService = {
  async listActive() {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
      },
    })

    return products.map((product) => ({
      ...product,
      price: Number(product.price),
    }))
  },
}
