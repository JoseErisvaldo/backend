import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ensureAuthenticated } from '../auth/auth.middleware'
import { asyncHandler } from '../../shared/async-handler'
import { paymentController } from './payment.controller'

export const paymentRoutes = Router()

paymentRoutes.post(
  '/webhook',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }),
  asyncHandler(paymentController.webhook),
)
paymentRoutes.get(
  '/',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 240 }),
  ensureAuthenticated,
  asyncHandler(paymentController.list),
)
paymentRoutes.get(
  '/:paymentId',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }),
  ensureAuthenticated,
  asyncHandler(paymentController.getById),
)
paymentRoutes.post(
  '/orders',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }),
  ensureAuthenticated,
  asyncHandler(paymentController.create),
)
