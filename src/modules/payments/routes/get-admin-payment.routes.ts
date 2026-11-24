import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Role } from '@prisma/client'
import { ensureAuthenticated, ensureRoles } from '../../auth/auth.middleware'
import { asyncHandler } from '../../../shared/async-handler'
import { paymentController } from '../controller/payment.controller'

export const getAdminPaymentRoutes = Router()
getAdminPaymentRoutes.get('/manage/:paymentId', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }), ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(paymentController.getByIdForAdmin))
