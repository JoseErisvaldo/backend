import type { Request, Response } from 'express'
import { productService } from './product.service'
import {
  createProductSchema,
  listAdminProductsQuerySchema,
  productIdSchema,
  setProductActiveSchema,
  updateProductSchema,
} from './product.schemas'

export const productController = {
  async list(_req: Request, res: Response) {
    res.status(200).json({ products: await productService.listActive() })
  },

  async listForAdmin(req: Request, res: Response) {
    const query = listAdminProductsQuerySchema.parse(req.query)
    res.status(200).json(await productService.listForAdmin(query))
  },

  async create(req: Request, res: Response) {
    const input = createProductSchema.parse(req.body)
    const product = await productService.create(input)
    res.status(201).json({ product })
  },

  async update(req: Request, res: Response) {
    const productId = productIdSchema.parse(req.params.productId)
    const input = updateProductSchema.parse(req.body)
    const product = await productService.update(productId, input)
    res.status(200).json({ product })
  },

  async setActive(req: Request, res: Response) {
    const productId = productIdSchema.parse(req.params.productId)
    const input = setProductActiveSchema.parse(req.body)
    const product = await productService.setActive(productId, input)
    res.status(200).json({ product })
  },
}
