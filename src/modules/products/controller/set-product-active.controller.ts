import type { Request, Response } from 'express'
import { setProductActive } from '../service/set-product-active.service'
import { productIdSchema } from '../schemas/product-id.schema'
import { setProductActiveSchema } from '../schemas/set-product-active.schema'

export async function setProductActiveController(req: Request, res: Response) {
  const productId = productIdSchema.parse(req.params.productId)
  const input = setProductActiveSchema.parse(req.body)
  res.status(200).json({ product: await setProductActive(productId, input) })
}
