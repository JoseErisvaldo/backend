import type { Request, Response } from 'express'
import { listPayments } from './list-user-payments.controller'
import { listAdminPayments } from './list-admin-payments.controller'
import { getAdminPayment } from './get-admin-payment.controller'
import { getUserPayment } from './get-user-payment.controller'
import { createPayment } from './create-payment.controller'
import { paymentWebhook } from './payment-webhook.controller'
import { adminOrdersDashboardQuerySchema } from '../schemas/admin-orders-dashboard.schemas'
import { getAdminOrdersDashboard } from '../service/get-admin-orders-dashboard.service'

export const paymentController = {
  list: listPayments,
  listForAdmin: listAdminPayments,
  getByIdForAdmin: getAdminPayment,
  getById: getUserPayment,
  create: createPayment,
  webhook: paymentWebhook,
  ordersDashboard: async (req: Request, res: Response) => {
    const query = adminOrdersDashboardQuerySchema.parse(req.query)
    res.status(200).json(await getAdminOrdersDashboard(query))
  },
}
