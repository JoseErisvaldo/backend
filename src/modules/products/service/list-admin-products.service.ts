import { prisma } from '../../../shared/prisma'
import type { listAdminProductsQuerySchema } from '../schemas/list-admin-products.schema'

type ListAdminProductsQuery = typeof listAdminProductsQuerySchema._output

export async function listAdminProducts(query: ListAdminProductsQuery) {
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
        active: true,
        createdAt: true,
      },
    }),
    prisma.product.count(),
  ])
  return {
    products: products.map((product) => ({ ...product, price: Number(product.price) })),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  }
}
