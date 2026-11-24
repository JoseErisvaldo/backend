import { Router } from 'express'
import { Role } from '@prisma/client'
import { ensureAuthenticated, ensureRoles } from '../../auth/auth.middleware'
import { asyncHandler } from '../../../shared/async-handler'
import { createProductController } from '../controller/create-product.controller'

export const createProductRoute = Router()
createProductRoute.post(
  '/',
  ensureAuthenticated,
  ensureRoles(Role.ADMIN, Role.MODERATOR),
  asyncHandler(createProductController),
)
