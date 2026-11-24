import { createPayment } from './create-payment.service'
import { getAdminPayment } from './get-admin-payment.service'
import { getUserPayment } from './get-user-payment.service'
import { listAdminPayments } from './list-admin-payments.service'
import { listUserPayments } from './list-user-payments.service'
import { processPaymentWebhook } from './payment-webhook.service'

export { createPayment, getAdminPayment, getUserPayment, listAdminPayments, listUserPayments, processPaymentWebhook }

export const paymentService = {
  create: createPayment,
  listByUser: listUserPayments,
  listForAdmin: listAdminPayments,
  getById: getUserPayment,
  getByIdForAdmin: getAdminPayment,
  processWebhook: processPaymentWebhook,
}
