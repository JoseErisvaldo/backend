import type { Request, Response } from 'express'
import { createProduct } from '../service/create-product.service'
import { createProductSchema } from '../schemas/create-product.schema'

export async function createProductController(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body)
  res.status(201).json({ product: await createProduct(input) })
}
