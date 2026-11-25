import { prisma } from '../../../shared/prisma'

const paidStatuses = new Set(['processed', 'approved', 'accredited'])

function getSaoPauloDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function getAdminOrdersDashboard(query: { dateFrom: string; dateTo: string }) {
  const payments = await prisma.payment.findMany({
    where: {
      createdAt: {
        gte: new Date(`${query.dateFrom}T00:00:00-03:00`),
        lte: new Date(`${query.dateTo}T23:59:59.999-03:00`),
      },
    },
    select: {
      amount: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      items: {
        select: { productName: true, quantity: true, unitPrice: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const statusTotals = new Map<string, { count: number; orderValue: number }>()
  const paymentMethodSales = new Map<string, { orders: number; sales: number }>()
  const productSales = new Map<string, { orderCount: number; paidAmount: number }>()
  const dailyCounts = new Map<string, {
    orders: number
    orderValue: number
    paidOrders: number
    sales: number
    statuses: Record<string, number>
    paymentMethods: Record<string, { orders: number; sales: number }>
  }>()
  for (
    let date = new Date(`${query.dateFrom}T00:00:00.000Z`);
    date <= new Date(`${query.dateTo}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    dailyCounts.set(date.toISOString().slice(0, 10), {
      orders: 0,
      orderValue: 0,
      paidOrders: 0,
      sales: 0,
      statuses: {},
      paymentMethods: {},
    })
  }
  let totalSales = 0
  let paidOrders = 0
  let paidSales = 0

  for (const payment of payments) {
    const status = payment.status.trim().toLowerCase() || 'unknown'
    const statusTotal = statusTotals.get(status) ?? { count: 0, orderValue: 0 }
    statusTotal.count += 1
    statusTotal.orderValue += Number(payment.amount)
    statusTotals.set(status, statusTotal)
    const amount = Number(payment.amount)
    const day = getSaoPauloDate(payment.createdAt)
    const daily = dailyCounts.get(day) ?? {
      orders: 0,
      orderValue: 0,
      paidOrders: 0,
      sales: 0,
      statuses: {},
      paymentMethods: {},
    }
    daily.orders += 1
    daily.orderValue += amount
    daily.statuses[status] = (daily.statuses[status] ?? 0) + 1
    if (paidStatuses.has(status)) {
      paidOrders += 1
      paidSales += amount
      daily.paidOrders += 1
      daily.sales += amount
      const method = payment.paymentMethod.trim().toLowerCase() || 'unknown'
      const methodSummary = paymentMethodSales.get(method) ?? { orders: 0, sales: 0 }
      methodSummary.orders += 1
      methodSummary.sales += amount
      paymentMethodSales.set(method, methodSummary)
      const dailyMethod = daily.paymentMethods[method] ?? { orders: 0, sales: 0 }
      dailyMethod.orders += 1
      dailyMethod.sales += amount
      daily.paymentMethods[method] = dailyMethod
      for (const item of payment.items) {
        const product = productSales.get(item.productName) ?? { orderCount: 0, paidAmount: 0 }
        product.orderCount += 1
        product.paidAmount += item.quantity * Number(item.unitPrice)
        productSales.set(item.productName, product)
      }
    }
    dailyCounts.set(day, daily)
    totalSales += paidStatuses.has(status) ? amount : 0
  }

  const daily = Array.from(dailyCounts, ([date, values]) => ({
    date,
    ...values,
    orderPercentage: payments.length ? values.orders / payments.length * 100 : 0,
    salesPercentage: totalSales ? values.sales / totalSales * 100 : 0,
    paymentMethods: Object.fromEntries(
      Object.entries(values.paymentMethods).map(([paymentMethod, methodValues]) => [
        paymentMethod,
        {
          ...methodValues,
          percentage: values.sales ? methodValues.sales / values.sales * 100 : 0,
        },
      ]),
    ),
  }))
  const statuses = Array.from(statusTotals, ([status, values]) => ({
    status,
    ...values,
    percentage: payments.length ? values.count / payments.length * 100 : 0,
  }))
    .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status))
  const paymentMethods = Array.from(paymentMethodSales, ([paymentMethod, values]) => ({
    paymentMethod,
    ...values,
    orderPercentage: paidOrders ? values.orders / paidOrders * 100 : 0,
    salesPercentage: totalSales ? values.sales / totalSales * 100 : 0,
  })).sort((left, right) => right.sales - left.sales || left.paymentMethod.localeCompare(right.paymentMethod))
  const totalPaidProductRevenue = Array.from(productSales.values())
    .reduce((sum, product) => sum + product.paidAmount, 0)
  const topProductsByOrders = Array.from(productSales, ([productName, values]) => ({
    productName,
    ...values,
    percentage: paidOrders ? values.orderCount / paidOrders * 100 : 0,
  }))
    .sort((left, right) => right.orderCount - left.orderCount || right.paidAmount - left.paidAmount)
    .slice(0, 10)
  const topProductsByRevenue = Array.from(productSales, ([productName, values]) => ({
    productName,
    ...values,
    percentage: totalPaidProductRevenue ? values.paidAmount / totalPaidProductRevenue * 100 : 0,
  }))
    .sort((left, right) => right.paidAmount - left.paidAmount || right.orderCount - left.orderCount)
    .slice(0, 10)

  return {
    summary: {
      totalOrders: payments.length,
      totalSales,
      paidOrders,
      averagePaidOrder: paidOrders ? paidSales / paidOrders : 0,
    },
    statuses,
    paymentMethods,
    topProductsByOrders,
    topProductsByRevenue,
    daily,
  }
}
