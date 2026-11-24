import { prisma } from '../../../shared/prisma'

export async function listAdminPayments(query: {
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
}
