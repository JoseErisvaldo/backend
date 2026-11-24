import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'

export async function getAdminPayment(paymentId: string) {
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
}
