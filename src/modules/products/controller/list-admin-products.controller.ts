import type { Request, Response } from 'express'
import { listAdminProducts } from '../service/list-admin-products.service'
import { listAdminProductsQuerySchema } from '../schemas/list-admin-products.schema'

export async function listAdminProductsController(req: Request, res: Response) {
  const query = listAdminProductsQuerySchema.parse(req.query)
  res.status(200).json(await listAdminProducts(query))
}
