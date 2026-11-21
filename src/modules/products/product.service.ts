import { prisma } from '../../shared/prisma'
import type { CreateProductInput, ListAdminProductsQuery } from './product.schemas'

export const productService = {
  async create(input: CreateProductInput) {
    const product = await prisma.product.create({
      data: input,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
      },
    })

    return { ...product, price: Number(product.price) }
  },

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

  async listForAdmin(query: ListAdminProductsQuery) {
    const sortOrderBy =
      query.sortBy === 'name'
        ? { name: query.sortOrder }
        : query.sortBy === 'description'
          ? { description: query.sortOrder }
          : { price: query.sortOrder }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip: query.page * query.pageSize,
        take: query.pageSize,
        orderBy: [sortOrderBy, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
        },
      }),
      prisma.product.count(),
    ])

    return {
      products: products.map((product) => ({
        ...product,
        price: Number(product.price),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    }
  },
}
