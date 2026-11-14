import { randomUUID } from 'node:crypto'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { env } from '../../config/env'
import { HttpError } from '../../shared/http-error'
import { prisma } from '../../shared/prisma'
import { createPaymentSchema, mercadoPagoWebhookSchema } from './payment.schemas'

const mercadoPagoOrderSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string().optional(),
  status_detail: z.string().optional(),
  transactions: z.object({
    payments: z.array(z.object({
      payment_method: z.object({
        qr_code: z.string().optional(),
        qr_code_base64: z.string().optional(),
        ticket_url: z.string().optional(),
      }).passthrough(),
    }).passthrough()),
  }).optional(),
}).passthrough()

const mercadoPagoErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  cause: z.array(z.object({
    code: z.union([z.string(), z.number()]).optional(),
  }).passthrough()).optional(),
}).passthrough()

type CreatePaymentInput = z.infer<typeof createPaymentSchema>

function getPaymentDetails(providerResponse: unknown) {
  const parsedOrder = mercadoPagoOrderSchema.safeParse(providerResponse)
  const paymentMethod = parsedOrder.success
    ? parsedOrder.data.transactions?.payments[0]?.payment_method
    : undefined
  return {
    qrCode: paymentMethod?.qr_code ?? null,
    qrCodeBase64: paymentMethod?.qr_code_base64 ?? null,
    ticketUrl: paymentMethod?.ticket_url ?? null,
  }
}

const sensitiveResponseKeys = new Set([
  'token',
  'client_token',
  'security_code',
  'card_number',
  'last_four_digits',
  'expiration_month',
  'expiration_year',
  'identification',
  'cardholder',
  'email',
  'phone',
  'address',
  'first_name',
  'last_name',
  'payer',
  'user_id',
])

function sanitizeProviderValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(sanitizeProviderValue)
  if (typeof value === 'object') {
    const sanitized: Record<string, Prisma.InputJsonValue | null> = {}
    for (const [key, child] of Object.entries(value)) {
      sanitized[key] = sensitiveResponseKeys.has(key.toLowerCase())
        ? '[REDACTED]'
        : sanitizeProviderValue(child)
    }
    return sanitized
  }
  throw new TypeError('Mercado Pago response is not valid JSON')
}

function sanitizeProviderResponse(value: unknown): Prisma.InputJsonValue {
  const sanitized = sanitizeProviderValue(value)
  if (sanitized === null || Array.isArray(sanitized) || typeof sanitized !== 'object') {
    throw new TypeError('Mercado Pago response must be a JSON object')
  }
  return sanitized
}

function verifyWebhookSignature(orderId: string, requestId: string | undefined, signature: string | undefined): boolean {
  if (!env.MP_WEBHOOK_SECRET || !requestId || !signature) return false
  const fields = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key, value.join('=')]
    }),
  )
  if (!fields.ts || !fields.v1) return false

  const manifest = `id:${orderId.toLowerCase()};request-id:${requestId};ts:${fields.ts};`
  const expected = createHmac('sha256', env.MP_WEBHOOK_SECRET).update(manifest).digest()
  let received: Buffer
  try {
    received = Buffer.from(fields.v1, 'hex')
  } catch {
    return false
  }
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export const paymentService = {
  async create(userId: string, input: CreatePaymentInput) {
    if (!env.MP_ACCESS_TOKEN) {
      throw new HttpError(503, 'O pagamento ainda não está configurado no servidor')
    }

    const [user, product] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
      prisma.product.findFirst({
        where: { id: input.productId, active: true },
        select: { id: true, name: true, price: true, currency: true },
      }),
    ])
    if (!user) throw new HttpError(404, 'Usuário não encontrado')
    if (!product) throw new HttpError(404, 'Produto não encontrado ou indisponível')
    if (product.currency !== 'BRL') throw new HttpError(400, 'Moeda do produto não suportada')

    const amount = product.price.toFixed(2)
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        productId: product.id,
        externalReference: randomUUID(),
        amount: product.price,
        paymentMethod: input.method === 'pix' ? 'pix' : input.paymentTypeId,
        status: 'processing',
      },
      select: { id: true, externalReference: true },
    })

    const requestBody = {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: amount,
      external_reference: payment.externalReference,
      payer: {
        email: user.email,
        ...(input.identification ? { identification: input.identification } : {}),
      },
      transactions: {
        payments: [{
          amount,
          payment_method: input.method === 'pix'
            ? { id: 'pix', type: 'bank_transfer' }
            : {
                id: input.paymentMethodId,
                type: input.paymentTypeId,
                token: input.token,
                installments: input.installments,
              },
          ...(input.method === 'pix' ? { expiration_time: 'PT24H' } : {}),
        }],
      },
    }

    try {
      const response = await fetch('https://api.mercadopago.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': payment.id,
        },
        body: JSON.stringify(requestBody),
      })

      const responseBody: unknown = await response.json()
      if (!response.ok) {
        const providerError = mercadoPagoErrorSchema.safeParse(responseBody)
        console.error('Mercado Pago order request failed', {
          status: response.status,
          requestId: response.headers.get('x-request-id'),
          error: providerError.success ? providerError.data.error : undefined,
          message: providerError.success ? providerError.data.message : undefined,
          causeCodes: providerError.success
            ? providerError.data.cause?.map((cause) => cause.code).filter((code) => code !== undefined)
            : undefined,
          externalReference: payment.externalReference,
        })
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        })
        throw new HttpError(502, 'O Mercado Pago não conseguiu processar o pagamento')
      }

      const order = mercadoPagoOrderSchema.parse(responseBody)
      const providerOrderId = String(order.id)
      const paymentDetails = getPaymentDetails(responseBody)
      if (input.method === 'pix' && !paymentDetails.qrCode && !paymentDetails.ticketUrl) {
        console.warn('Mercado Pago Pix order response did not include payment instructions', {
          providerOrderId,
        })
      }
      const savedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerOrderId,
          status: order.status ?? 'processing',
          statusDetail: order.status_detail,
          providerResponse: sanitizeProviderResponse(responseBody),
        },
        select: { id: true, status: true, statusDetail: true, amount: true, paymentMethod: true },
      })

      return {
        payment: {
          ...savedPayment,
          amount: Number(savedPayment.amount),
          productName: product.name,
          providerOrderId,
          paymentMethod: savedPayment.paymentMethod,
          ...paymentDetails,
        },
      }
    } catch (error) {
      if (error instanceof HttpError) throw error
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      })
      console.error('Mercado Pago order creation failed', error)
      throw new HttpError(502, 'Não foi possível concluir o pagamento')
    }
  },

  async processWebhook(input: unknown, queryId: unknown, requestId: string | undefined, signature: string | undefined) {
    if (!env.MP_WEBHOOK_SECRET) {
      throw new HttpError(503, 'Webhook do Mercado Pago não está configurado')
    }
    const body = mercadoPagoWebhookSchema.parse(input)
    const orderId = String(queryId ?? body.data?.id ?? body.id ?? '')
    if (!orderId || orderId.length > 100) throw new HttpError(400, 'Identificador do pedido inválido')
    if (!verifyWebhookSignature(orderId, requestId, signature)) {
      throw new HttpError(401, 'Assinatura do webhook inválida')
    }
    if (!env.MP_ACCESS_TOKEN) {
      throw new HttpError(503, 'Integração com Mercado Pago não está configurada')
    }

    const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
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
    const updateResult = await prisma.payment.updateMany({
      where: { externalReference: order.external_reference },
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
  },

  async getById(userId: string, paymentId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        status: true,
        statusDetail: true,
        providerOrderId: true,
        providerResponse: true,
        product: { select: { name: true } },
      },
    })
    if (!payment) throw new HttpError(404, 'Pagamento não encontrado')

    return {
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        statusDetail: payment.statusDetail,
        providerOrderId: payment.providerOrderId,
        productName: payment.product.name,
        ...getPaymentDetails(payment.providerResponse),
      },
    }
  },
}
