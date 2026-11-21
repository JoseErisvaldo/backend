import { prisma } from '../../shared/prisma'
import { HttpError } from '../../shared/http-error'
import type {
  CreateProductInput,
  ListAdminProductsQuery,
  SetProductActiveInput,
  UpdateProductInput,
} from './product.schemas'

async function ensureProductExists(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new HttpError(404, 'Produto não encontrado')
}

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
          active: true,
          createdAt: true,
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

  async update(productId: string, input: UpdateProductInput) {
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
  },

  async setActive(productId: string, input: SetProductActiveInput) {
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
  },
}
