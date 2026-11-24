import type { Request, Response } from 'express'
import { listProducts } from '../service/list-products.service'

export async function listProductsController(_req: Request, res: Response) {
  res.status(200).json({ products: await listProducts() })
}
