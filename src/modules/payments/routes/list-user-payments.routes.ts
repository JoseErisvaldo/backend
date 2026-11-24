import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ensureAuthenticated } from '../../auth/auth.middleware'
import { asyncHandler } from '../../../shared/async-handler'
import { paymentController } from '../controller/payment.controller'

export const listUserPaymentsRoutes = Router()
listUserPaymentsRoutes.get('/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 240 }), ensureAuthenticated, asyncHandler(paymentController.list))
