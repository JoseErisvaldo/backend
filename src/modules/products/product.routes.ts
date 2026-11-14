import { Router } from 'express'
import { asyncHandler } from '../../shared/async-handler'
import { productController } from './product.controller'

export const productRoutes = Router()

productRoutes.get('/', asyncHandler(productController.list))
