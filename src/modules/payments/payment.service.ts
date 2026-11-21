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
  type: z.string().optional(),
  processing_mode: z.string().optional(),
  status: z.string().optional(),
  status_detail: z.string().optional(),
  external_reference: z.string().optional(),
  last_updated_date: z.string().optional(),
  currency: z.string().optional(),
  capture_mode: z.string().optional(),
  country_code: z.string().optional(),
  created_date: z.string().optional(),
  total_amount: z.union([z.string(), z.number()]).optional(),
  total_paid_amount: z.union([z.string(), z.number()]).optional(),
  transactions: z.object({
    payments: z.array(z.object({
      id: z.union([z.string(), z.number()]).optional(),
      amount: z.union([z.string(), z.number()]).optional(),
      status: z.string().optional(),
      status_detail: z.string().optional(),
      reference_id: z.string().optional(),
      expiration_time: z.string().optional(),
      date_of_expiration: z.string().optional(),
      payment_method: z.object({
        id: z.string().optional(),
        type: z.string().optional(),
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

function getMercadoPagoAccessToken() {
  const accessToken = env.MP_ACCESS_TOKEN
  if (!accessToken) {
    throw new HttpError(
      503,
      'O pagamento ainda não está configurado no servidor',
    )
  }
  return accessToken
}

function getPaymentDetails(providerResponse: unknown, createdAt?: Date) {
  const parsedOrder = mercadoPagoOrderSchema.safeParse(providerResponse)
  const order = parsedOrder.success ? parsedOrder.data : undefined
  const providerPayment = parsedOrder.success
    ? order?.transactions?.payments[0]
    : undefined
  const paymentMethod = providerPayment?.payment_method
  const expiresAt = providerPayment?.date_of_expiration ??
    (paymentMethod?.id === 'pix' && createdAt
      ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null)
  return {
    qrCode: paymentMethod?.qr_code ?? null,
    qrCodeBase64: paymentMethod?.qr_code_base64 ?? null,
    ticketUrl: paymentMethod?.ticket_url ?? null,
    expiresAt,
    providerOrderDetails: order
      ? {
          id: String(order.id),
          type: order.type ?? null,
          processingMode: order.processing_mode ?? null,
          status: order.status ?? null,
          statusDetail: order.status_detail ?? null,
          externalReference: order.external_reference ?? null,
          updatedAt: order.last_updated_date ?? null,
          currency: order.currency ?? null,
          captureMode: order.capture_mode ?? null,
          countryCode: order.country_code ?? null,
          createdAt: order.created_date ?? null,
          totalAmount:
            order.total_amount == null ? null : Number(order.total_amount),
          totalPaidAmount:
            order.total_paid_amount == null
              ? null
              : Number(order.total_paid_amount),
          payment: providerPayment
            ? {
                id:
                  providerPayment.id == null
                    ? null
                    : String(providerPayment.id),
                amount:
                  providerPayment.amount == null
                    ? null
                    : Number(providerPayment.amount),
                status: providerPayment.status ?? null,
                statusDetail: providerPayment.status_detail ?? null,
                referenceId: providerPayment.reference_id ?? null,
                expirationTime: providerPayment.expiration_time ?? null,
                method: paymentMethod?.id ?? null,
                methodType: paymentMethod?.type ?? null,
                expiresAt: providerPayment.date_of_expiration ?? null,
              }
            : null,
        }
      : null,
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
  async listForAdmin(query: {
    page: number
    pageSize: number
    search?: string
    customerName?: string
    paymentMethod?: 'pix' | 'card'
    status?: string
    dateFrom?: string
    dateTo?: string
    sortBy: 'createdAt' | 'amount' | 'status'
    sortOrder: 'asc' | 'desc'
  }) {
    const search = query.search?.trim()
    const customerName = query.customerName?.trim()
    const status = query.status
    const statusWhere = status === 'paid'
      ? { in: ['processed', 'approved', 'accredited'] }
      : status === 'pending'
        ? { in: ['action_required', 'processing', 'pending', 'created'] }
        : status === 'failed'
          ? { in: ['failed', 'rejected', 'declined', 'error', 'processing_error'] }
          : status === 'cancelled'
            ? { in: ['cancelled', 'canceled'] }
            : status === 'expired'
              ? { equals: 'expired', mode: 'insensitive' as const }
              : undefined
    const where = {
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' as const } },
              { externalReference: { contains: search, mode: 'insensitive' as const } },
              { providerOrderId: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(customerName
        ? { user: { name: { contains: customerName, mode: 'insensitive' as const } } }
        : {}),
      ...(query.paymentMethod === 'pix'
        ? { paymentMethod: 'pix' }
        : query.paymentMethod === 'card'
          ? { paymentMethod: { not: 'pix' } }
          : {}),
      ...(statusWhere ? { status: statusWhere } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00-03:00`) } : {}),
              ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999-03:00`) } : {}),
            },
          }
        : {}),
    }
    const orderBy =
      query.sortBy === 'amount'
        ? [{ amount: query.sortOrder }, { id: 'asc' as const }]
        : query.sortBy === 'status'
          ? [{ status: query.sortOrder }, { id: 'asc' as const }]
          : [{ createdAt: query.sortOrder }, { id: 'asc' as const }]
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          status: true,
          statusDetail: true,
          providerOrderId: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          items: { select: { productName: true } },
        },
      }),
      prisma.payment.count({ where }),
    ])

    return {
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        statusDetail: payment.statusDetail,
        providerOrderId: payment.providerOrderId,
        productSummary: payment.items.length === 1
          ? payment.items[0].productName
          : `${payment.items.length} produtos`,
        createdAt: payment.createdAt.toISOString(),
        customer: payment.user,
      })),
      pagination: { page: query.page, pageSize: query.pageSize, total },
    }
  },

  async getByIdForAdmin(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        status: true,
        statusDetail: true,
        providerOrderId: true,
        externalReference: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPrice: true,
            currency: true,
          },
        },
      },
    })
    if (!payment) throw new HttpError(404, 'Pedido não encontrado')

    return {
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        statusDetail: payment.statusDetail,
        providerOrderId: payment.providerOrderId,
        externalReference: payment.externalReference,
        createdAt: payment.createdAt.toISOString(),
        customer: payment.user,
        items: payment.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.unitPrice) * item.quantity,
          currency: item.currency,
        })),
      },
    }
  },

  async listByUser(userId: string, page: number, pageSize: number) {
    const where = { userId }
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          status: true,
          statusDetail: true,
          providerOrderId: true,
          createdAt: true,
          items: {
            select: {
              productName: true,
              quantity: true,
              unitPrice: true,
              currency: true,
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ])

    return {
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        statusDetail: payment.statusDetail,
        providerOrderId: payment.providerOrderId,
        productName: payment.items.length === 1
          ? payment.items[0].productName
          : `${payment.items.length} produtos`,
        currency: payment.items[0]?.currency ?? 'BRL',
        items: payment.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.unitPrice) * item.quantity,
          currency: item.currency,
        })),
        createdAt: payment.createdAt.toISOString(),
        expiresAt: payment.paymentMethod === 'pix'
          ? new Date(payment.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
          : null,
      })),
      pagination: { page, pageSize, total },
    }
  },

  async create(userId: string, input: CreatePaymentInput) {
    const accessToken = getMercadoPagoAccessToken()

    const [user, products] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
      prisma.product.findMany({
        where: { id: { in: input.items.map((item) => item.productId) }, active: true },
        select: { id: true, name: true, price: true, currency: true },
      }),
    ])
    if (!user) throw new HttpError(404, 'Usuário não encontrado')
    if (products.length !== input.items.length) {
      throw new HttpError(404, 'Um ou mais produtos não foram encontrados ou estão indisponíveis')
    }

    const productsById = new Map(products.map((product) => [product.id, product]))
    const cartLines = input.items.map((item) => {
      const product = productsById.get(item.productId)
      if (!product) throw new HttpError(404, 'Produto não encontrado ou indisponível')
      if (product.currency !== 'BRL') throw new HttpError(400, 'Moeda do produto não suportada')
      return { product, quantity: item.quantity, lineTotal: product.price.mul(item.quantity) }
    })
    const totalAmount = cartLines.reduce(
      (total, item) => total.plus(item.lineTotal),
      new Prisma.Decimal(0),
    )

    const amount = totalAmount.toFixed(2)
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        externalReference: randomUUID(),
        amount: totalAmount,
        paymentMethod: input.method === 'pix' ? 'pix' : input.paymentTypeId,
        status: 'processing',
        items: {
          create: cartLines.map(({ product, quantity }) => ({
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: product.price,
            currency: product.currency,
          })),
        },
      },
      select: { id: true, externalReference: true, createdAt: true },
    })

    const requestBody = {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: amount,
      external_reference: payment.externalReference,
      payer: {
        email: user.email,
        ...(env.MP_PIX_APPROVAL_TEST_MODE && input.method === 'pix'
          ? { first_name: 'APRO' }
          : {}),
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
          Authorization: `Bearer ${accessToken}`,
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
      const paymentDetails = getPaymentDetails(responseBody, payment.createdAt)
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
          productName: cartLines.length === 1
            ? cartLines[0].product.name
            : `${cartLines.length} produtos`,
          currency: cartLines[0].product.currency,
          items: cartLines.map(({ product, quantity }) => ({
            productName: product.name,
            quantity,
            unitPrice: Number(product.price),
            lineTotal: Number(product.price) * quantity,
            currency: product.currency,
          })),
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
        createdAt: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPrice: true,
            currency: true,
          },
        },
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
        productName: payment.items.length === 1
          ? payment.items[0].productName
          : `${payment.items.length} produtos`,
        currency: payment.items[0]?.currency ?? 'BRL',
        items: payment.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.unitPrice) * item.quantity,
          currency: item.currency,
        })),
        createdAt: payment.createdAt.toISOString(),
        ...getPaymentDetails(payment.providerResponse, payment.createdAt),
      },
    }
  },
}
