import { Router } from 'express'
import { asyncHandler } from '../../../shared/async-handler'
import { listProductsController } from '../controller/list-products.controller'

export const listProductsRoute = Router()
listProductsRoute.get('/', asyncHandler(listProductsController))
