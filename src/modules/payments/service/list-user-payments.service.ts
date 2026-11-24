import { prisma } from '../../../shared/prisma'

export async function listUserPayments(userId: string, page: number, pageSize: number) {
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
}
