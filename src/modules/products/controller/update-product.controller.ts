import type { Request, Response } from 'express'
import { updateProduct } from '../service/update-product.service'
import { productIdSchema } from '../schemas/product-id.schema'
import { updateProductSchema } from '../schemas/update-product.schema'

export async function updateProductController(req: Request, res: Response) {
  const productId = productIdSchema.parse(req.params.productId)
  const input = updateProductSchema.parse(req.body)
  res.status(200).json({ product: await updateProduct(productId, input) })
}
