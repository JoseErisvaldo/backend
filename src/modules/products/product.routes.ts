import { Router } from 'express'
import { Role } from '@prisma/client'
import { ensureAuthenticated, ensureRoles } from '../auth/auth.middleware'
import { asyncHandler } from '../../shared/async-handler'
import { productController } from './product.controller'

export const productRoutes = Router()

productRoutes.get(
  '/manage',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(productController.listForAdmin),
)
productRoutes.patch(
  '/:productId/status',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(productController.setActive),
)
productRoutes.patch(
  '/:productId',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(productController.update),
)
productRoutes.get('/', asyncHandler(productController.list))
productRoutes.post(
  '/',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(productController.create),
)
