import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../../../shared/async-handler'
import { paymentController } from '../controller/payment.controller'

export const paymentWebhookRoutes = Router()
paymentWebhookRoutes.post('/webhook', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), asyncHandler(paymentController.webhook))
