import { Router } from 'express'
import { Role } from '@prisma/client'
import { ensureAuthenticated, ensureRoles } from '../../auth/auth.middleware'
import { asyncHandler } from '../../../shared/async-handler'
import { updateProductController } from '../controller/update-product.controller'

export const updateProductRoute = Router()
updateProductRoute.patch(
  '/:productId',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(updateProductController),
)
