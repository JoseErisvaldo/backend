import type { Request, Response } from 'express'
import { productService } from './product.service'

export const productController = {
  async list(_req: Request, res: Response) {
    res.status(200).json({ products: await productService.listActive() })
  },
}
