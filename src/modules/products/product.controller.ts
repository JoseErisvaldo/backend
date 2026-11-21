import type { Request, Response } from 'express'
import { productService } from './product.service'
import { createProductSchema, listAdminProductsQuerySchema } from './product.schemas'

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
}
