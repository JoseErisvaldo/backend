import { Router } from 'express'
import { Role } from '@prisma/client'
import { ensureAuthenticated, ensureRoles } from '../../auth/auth.middleware'
import { asyncHandler } from '../../../shared/async-handler'
import { listAdminProductsController } from '../controller/list-admin-products.controller'

export const listAdminProductsRoute = Router()
listAdminProductsRoute.get(
  '/manage',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(listAdminProductsController),
)
