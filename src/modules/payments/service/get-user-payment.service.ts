import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { getPaymentDetails } from '../helpers/payment.shared'

export async function getUserPayment(userId: string, paymentId: string) {
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
}
