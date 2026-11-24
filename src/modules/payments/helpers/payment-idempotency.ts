import { Prisma } from '@prisma/client'
import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { createPaymentSchema } from '../schemas/payment.schemas'

type CreatePaymentInput = ReturnType<typeof createPaymentSchema.parse>

export const idempotentPaymentSelect = {
  id: true,
  userId: true,
  externalReference: true,
  providerOrderId: true,
  amount: true,
  paymentMethod: true,
  status: true,
  statusDetail: true,
  providerResponse: true,
  createdAt: true,
  items: {
    select: {
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      currency: true,
    },
  },
} satisfies Prisma.PaymentSelect

export type IdempotentPayment = Prisma.PaymentGetPayload<{
  select: typeof idempotentPaymentSelect
}>

export function assertSameIdempotentRequest(
  payment: IdempotentPayment,
  userId: string,
  input: CreatePaymentInput,
) {
  const requestedMethod = input.method === 'pix' ? 'pix' : input.paymentTypeId
  const requestedItems = input.items
    .map(({ productId, quantity }) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId))
  const savedItems = payment.items
    .map(({ productId, quantity }) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId))

  if (
    payment.userId !== userId ||
    payment.paymentMethod !== requestedMethod ||
    JSON.stringify(savedItems) !== JSON.stringify(requestedItems)
  ) {
    throw new HttpError(409, 'A chave de idempotência já foi usada em outra solicitação')
  }
}

export function findPaymentByIdempotencyKey(idempotencyKey: string) {
  return prisma.payment.findUnique({
    where: { idempotencyKey },
    select: idempotentPaymentSelect,
  })
}

export async function findProviderCreatedPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: idempotentPaymentSelect,
  })

  return payment?.providerOrderId && payment.providerResponse ? payment : null
}

export function markPaymentAsFailed(paymentId: string) {
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'failed' },
  })
}
