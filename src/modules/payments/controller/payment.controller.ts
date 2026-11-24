import { listPayments } from './list-user-payments.controller'
import { listAdminPayments } from './list-admin-payments.controller'
import { getAdminPayment } from './get-admin-payment.controller'
import { getUserPayment } from './get-user-payment.controller'
import { createPayment } from './create-payment.controller'
import { paymentWebhook } from './payment-webhook.controller'

export const paymentController = {
  list: listPayments,
  listForAdmin: listAdminPayments,
  getByIdForAdmin: getAdminPayment,
  getById: getUserPayment,
  create: createPayment,
  webhook: paymentWebhook,
}
