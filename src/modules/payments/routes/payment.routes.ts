import { Router } from 'express'
import { paymentWebhookRoutes } from './payment-webhook.routes'
import { listAdminPaymentsRoutes } from './list-admin-payments.routes'
import { getAdminPaymentRoutes } from './get-admin-payment.routes'
import { listUserPaymentsRoutes } from './list-user-payments.routes'
import { getUserPaymentRoutes } from './get-user-payment.routes'
import { createPaymentRoutes } from './create-payment.routes'

export const paymentRoutes = Router()
paymentRoutes.use(paymentWebhookRoutes, listAdminPaymentsRoutes, getAdminPaymentRoutes, listUserPaymentsRoutes, getUserPaymentRoutes, createPaymentRoutes)
