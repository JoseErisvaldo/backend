import { Router } from 'express'
import { createProductRoute } from './create-product.route'
import { listAdminProductsRoute } from './list-admin-products.route'
import { listProductsRoute } from './list-products.route'
import { setProductActiveRoute } from './set-product-active.route'
import { updateProductRoute } from './update-product.route'

export const productRoutes = Router()
productRoutes.use(
  listAdminProductsRoute,
  setProductActiveRoute,
  updateProductRoute,
  listProductsRoute,
  createProductRoute,
)
