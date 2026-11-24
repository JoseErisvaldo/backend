import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { env } from '../../../config/env'
import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { createPaymentSchema } from '../schemas/create-payment.schemas'
import { mercadoPagoErrorSchema, mercadoPagoOrderSchema } from '../schemas/mercado-pago.schemas'
type CreatePaymentInput = ReturnType<typeof createPaymentSchema.parse>

import { assertSameIdempotentRequest, findPaymentByIdempotencyKey, findProviderCreatedPayment, idempotentPaymentSelect, markPaymentAsFailed } from '../helpers/payment-idempotency'
import { assertProviderOrderMatchesPayment, getMercadoPagoAccessToken, sanitizeProviderResponse, serializeCreatedPayment } from '../helpers/payment.shared'

function serializeCreatedPaymentOrThrow(payment: Parameters<typeof serializeCreatedPayment>[0]) {
  const result = serializeCreatedPayment(payment)
  if (
    payment.paymentMethod === 'pix' &&
    !result.payment.qrCode &&
    !result.payment.qrCodeBase64 &&
    !result.payment.ticketUrl
  ) {
    const providerPayment = result.payment.providerOrderDetails?.payment
    console.error('Mercado Pago Pix order has no payment instructions', {
      providerOrderId: payment.providerOrderId,
      orderStatus: result.payment.providerOrderDetails?.status,
      paymentStatus: providerPayment?.status,
      paymentMethod: providerPayment?.method,
      hasQrCode: Boolean(result.payment.qrCode),
      hasQrCodeBase64: Boolean(result.payment.qrCodeBase64),
      hasTicketUrl: Boolean(result.payment.ticketUrl),
    })
    throw new HttpError(
      502,
      'O Mercado Pago criou o pedido, mas não retornou as instruções Pix. Não inicie outra cobrança; verifique o pedido existente no Mercado Pago.',
    )
  }
  return result
}

export async function createPayment(userId: string, input: CreatePaymentInput, idempotencyKey: string) {
  const accessToken = getMercadoPagoAccessToken()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) throw new HttpError(404, 'Usuário não encontrado')
  let payment = await findPaymentByIdempotencyKey(idempotencyKey)

  if (payment) {
    assertSameIdempotentRequest(payment, userId, input)
    if (payment.providerOrderId && payment.providerResponse) {
      return serializeCreatedPaymentOrThrow(payment)
    }
    if (payment.status === 'failed') {
      throw new HttpError(409, 'Esta tentativa falhou. Inicie uma nova tentativa de pagamento.')
    }
  } else {
    const products = await prisma.product.findMany({
      where: { id: { in: input.items.map((item) => item.productId) }, active: true },
      select: { id: true, name: true, price: true, currency: true },
    })
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

    try {
      payment = await prisma.payment.create({
        data: {
          userId: user.id,
          externalReference: randomUUID(),
          idempotencyKey,
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
        select: idempotentPaymentSelect,
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error
      }
      payment = await findPaymentByIdempotencyKey(idempotencyKey)
      if (!payment) throw error
      assertSameIdempotentRequest(payment, userId, input)
      if (payment.providerOrderId && payment.providerResponse) {
        return serializeCreatedPaymentOrThrow(payment)
      }
      if (payment.status === 'failed') {
        throw new HttpError(409, 'Esta tentativa falhou. Inicie uma nova tentativa de pagamento.')
      }
    }
  }

  const amount = payment.amount.toFixed(2)

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
        'X-Idempotency-Key': idempotencyKey,
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
      const definitiveRejection =
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429
      if (definitiveRejection) {
        const providerCreatedPayment = await findProviderCreatedPayment(payment.id)
        if (providerCreatedPayment) {
          return serializeCreatedPaymentOrThrow(providerCreatedPayment)
        }
        await markPaymentAsFailed(payment.id)
        throw new HttpError(422, 'O Mercado Pago não conseguiu processar o pagamento')
      }
      throw new HttpError(503, 'Não foi possível confirmar o resultado. Tente novamente com segurança.')
    }

    const order = mercadoPagoOrderSchema.parse(responseBody)
    assertProviderOrderMatchesPayment(
      order,
      payment,
      input.method === 'card' ? input.installments : undefined,
    )
    const providerOrderId = String(order.id)
    const savedOrder = await prisma.payment.updateMany({
      where: { id: payment.id, providerOrderId: null },
      data: {
        providerOrderId,
        status: order.status ?? 'processing',
        statusDetail: order.status_detail,
        providerResponse: sanitizeProviderResponse(responseBody),
      },
    })
    const savedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: idempotentPaymentSelect,
    })
    if (!savedPayment) throw new HttpError(404, 'Pagamento não encontrado')
    if (savedPayment.providerOrderId !== providerOrderId) {
      throw new HttpError(502, 'O pedido retornado não corresponde ao pagamento local')
    }
    if (savedOrder.count === 0 && !savedPayment.providerResponse) {
      throw new HttpError(503, 'O resultado do pagamento ainda está sendo confirmado')
    }

    return serializeCreatedPaymentOrThrow(savedPayment)
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error('Mercado Pago order creation failed', error)
    throw new HttpError(502, 'Não foi possível concluir o pagamento')
  }
}
