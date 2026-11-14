import { Router } from 'express'
import { ensureAuthenticated } from '../auth/auth.middleware'
import { asyncHandler } from '../../shared/async-handler'
import { paymentController } from './payment.controller'

export const paymentRoutes = Router()

paymentRoutes.post('/webhook', asyncHandler(paymentController.webhook))
paymentRoutes.get('/:paymentId', ensureAuthenticated, asyncHandler(paymentController.getById))
paymentRoutes.post('/orders', ensureAuthenticated, asyncHandler(paymentController.create))
