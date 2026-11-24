import { z } from 'zod'
import { env } from '../../../config/env'
import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { mercadoPagoWebhookSchema } from '../schemas/payment-webhook.schemas'
import { mercadoPagoOrderSchema } from '../schemas/mercado-pago.schemas'
import { idempotentPaymentSelect } from '../helpers/payment-idempotency'
import { assertProviderOrderMatchesPayment, getMercadoPagoAccessToken, sanitizeProviderResponse, verifyWebhookSignature } from '../helpers/payment.shared'

export async function processPaymentWebhook(input: unknown, queryId: unknown, requestId: string | undefined, signature: string | undefined) {
  if (!env.MP_WEBHOOK_SECRET) {
    throw new HttpError(503, 'Webhook do Mercado Pago não está configurado')
  }
  const body = mercadoPagoWebhookSchema.parse(input)
  const orderId = String(queryId ?? body.data?.id ?? body.id ?? '')
  if (!orderId || orderId.length > 100) throw new HttpError(400, 'Identificador do pedido inválido')
  if (!verifyWebhookSignature(orderId, requestId, signature)) {
    throw new HttpError(401, 'Assinatura do webhook inválida')
  }
  const accessToken = getMercadoPagoAccessToken()

  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    console.error('Mercado Pago webhook order lookup failed', {
      orderId,
      status: response.status,
      requestId: response.headers.get('x-request-id'),
    })
    throw new HttpError(502, 'Não foi possível consultar o pedido no Mercado Pago')
  }
  const order = mercadoPagoOrderSchema.extend({
    external_reference: z.string().min(1),
  }).parse(await response.json())
  const payment = await prisma.payment.findUnique({
    where: { externalReference: order.external_reference },
    select: idempotentPaymentSelect,
  })
  if (!payment) {
    console.warn('Mercado Pago webhook did not match a local payment', {
      orderId: String(order.id),
      externalReference: order.external_reference,
    })
    return
  }
  if (payment.providerOrderId && payment.providerOrderId !== String(order.id)) {
    throw new HttpError(409, 'O pedido do webhook não corresponde ao pagamento local')
  }
  assertProviderOrderMatchesPayment(order, payment)

  const updateResult = await prisma.payment.updateMany({
    where: { id: payment.id },
    data: {
      providerOrderId: String(order.id),
      status: order.status ?? 'processing',
      statusDetail: order.status_detail,
      providerResponse: sanitizeProviderResponse(order),
    },
  })
  if (updateResult.count === 0) {
    console.warn('Mercado Pago webhook did not match a local payment', {
      orderId: String(order.id),
      externalReference: order.external_reference,
    })
    return
  }
  console.info('Mercado Pago payment status updated', {
    orderId: String(order.id),
    status: order.status ?? 'processing',
    updatedPayments: updateResult.count,
  })
}
