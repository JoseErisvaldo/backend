import { Router } from 'express'
import { Role } from '@prisma/client'
import { ensureAuthenticated, ensureRoles } from '../../auth/auth.middleware'
import { asyncHandler } from '../../../shared/async-handler'
import { setProductActiveController } from '../controller/set-product-active.controller'

export const setProductActiveRoute = Router()
setProductActiveRoute.patch(
  '/:productId/status',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(setProductActiveController),
)
