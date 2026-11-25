import { prisma } from '../../../shared/prisma'

const paidChargeStatuses = new Set(['approved', 'accredited', 'processed'])
const activeSubscriptionStatuses = ['authorized', 'active']

type DashboardQuery = {
  dateFrom: string
  dateTo: string
  upcomingPage: number
  upcomingPageSize: number
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function addMonthsClamped(date: Date, months: number) {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

function getNextChargeDate(date: Date, recurrence: string) {
  if (recurrence === 'WEEKLY') {
    const result = new Date(date)
    result.setUTCDate(result.getUTCDate() + 7)
    return result
  }
  const months = recurrence === 'QUARTERLY' ? 3 : recurrence === 'YEARLY' ? 12 : 1
  return addMonthsClamped(date, months)
}

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

export async function getAdminSubscriptionsDashboard(query: DashboardQuery) {
  const start = new Date(`${query.dateFrom}T00:00:00-03:00`)
  const end = new Date(`${query.dateTo}T23:59:59.999-03:00`)
  const forecastStartDate = getSaoPauloDate(new Date())
  const forecastEndDate = addDays(forecastStartDate, 29)
  const forecastStart = new Date(`${forecastStartDate}T00:00:00-03:00`)
  const forecastEnd = new Date(`${forecastEndDate}T23:59:59.999-03:00`)
  const [subscriptions, activeSubscriptions, charges, upcomingSubscriptions] = await Promise.all([
    prisma.subscription.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { planName: true, planAmount: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.subscription.count({ where: { status: { in: activeSubscriptionStatuses } } }),
    prisma.subscriptionCharge.findMany({
      where: {
        OR: [
          { paidAt: { gte: start, lte: end } },
          { paidAt: null, createdAt: { gte: start, lte: end } },
        ],
      },
      select: { amount: true, status: true, paidAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.subscription.findMany({
      where: {
        status: { in: activeSubscriptionStatuses },
        nextPaymentDate: { gte: forecastStart, lte: forecastEnd },
      },
      select: {
        id: true,
        nextPaymentDate: true,
        planAmount: true,
        planRecurrence: true,
        planName: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ])

  const dailyCounts = new Map<string, {
    subscriptions: number
    statuses: Record<string, number>
    paidCharges: number
    paidRevenue: number
  }>()
  for (
    let date = new Date(`${query.dateFrom}T00:00:00.000Z`);
    date <= new Date(`${query.dateTo}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    dailyCounts.set(date.toISOString().slice(0, 10), {
      subscriptions: 0,
      statuses: {},
      paidCharges: 0,
      paidRevenue: 0,
    })
  }

  const statusCounts = new Map<string, number>()
  const planTotals = new Map<string, { count: number; contractedAmount: number }>()
  for (const subscription of subscriptions) {
    const status = subscription.status.trim().toLowerCase() || 'unknown'
    const day = getSaoPauloDate(subscription.createdAt)
    const daily = dailyCounts.get(day)
    if (daily) {
      daily.subscriptions += 1
      daily.statuses[status] = (daily.statuses[status] ?? 0) + 1
    }
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
    const plan = planTotals.get(subscription.planName) ?? { count: 0, contractedAmount: 0 }
    plan.count += 1
    plan.contractedAmount += Number(subscription.planAmount)
    planTotals.set(subscription.planName, plan)
  }

  let paidCharges = 0
  let paidRevenue = 0
  for (const charge of charges) {
    const status = charge.status.trim().toLowerCase()
    if (!paidChargeStatuses.has(status)) continue
    const amount = Number(charge.amount ?? 0)
    const day = getSaoPauloDate(charge.paidAt ?? charge.createdAt)
    const daily = dailyCounts.get(day)
    if (daily) {
      daily.paidCharges += 1
      daily.paidRevenue += amount
    }
    paidCharges += 1
    paidRevenue += amount
  }

  const totalSubscriptions = subscriptions.length
  const statuses = Array.from(statusCounts, ([status, count]) => ({
    status,
    count,
    percentage: totalSubscriptions ? count / totalSubscriptions * 100 : 0,
  })).sort((left, right) => right.count - left.count || left.status.localeCompare(right.status))
  const plans = Array.from(planTotals, ([name, values]) => ({
    name,
    ...values,
    percentage: totalSubscriptions ? values.count / totalSubscriptions * 100 : 0,
  })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)).slice(0, 10)
  const forecastMap = new Map<string, { expectedCharges: number; expectedAmount: number }>()
  const upcomingCharges: Array<{
    date: string
    subscriptionId: string
    customerName: string
    customerEmail: string
    planName: string
    amount: number
  }> = []
  for (let index = 0; index < 30; index += 1) {
    const date = addDays(forecastStartDate, index)
    forecastMap.set(date, { expectedCharges: 0, expectedAmount: 0 })
  }
  for (const subscription of upcomingSubscriptions) {
    if (!subscription.nextPaymentDate) continue
    let nextDate = subscription.nextPaymentDate
    while (nextDate <= forecastEnd) {
      const forecastDay = getSaoPauloDate(nextDate)
      const dailyForecast = forecastMap.get(forecastDay)
      if (dailyForecast) {
        dailyForecast.expectedCharges += 1
        const amount = Number(subscription.planAmount)
        dailyForecast.expectedAmount += amount
        upcomingCharges.push({
          date: forecastDay,
          subscriptionId: subscription.id,
          customerName: subscription.user.name,
          customerEmail: subscription.user.email,
          planName: subscription.planName,
          amount,
        })
      }
      nextDate = getNextChargeDate(nextDate, subscription.planRecurrence)
    }
  }
  const forecast = Array.from(forecastMap, ([date, values]) => ({ date, ...values }))
  upcomingCharges.sort((left, right) =>
    left.date.localeCompare(right.date)
    || left.customerName.localeCompare(right.customerName)
    || left.planName.localeCompare(right.planName),
  )

  return {
    summary: { totalSubscriptions, activeSubscriptions, paidCharges, paidRevenue },
    statuses,
    plans,
    daily: Array.from(dailyCounts, ([date, values]) => ({ date, ...values })),
    forecast: {
      startDate: forecastStartDate,
      endDate: forecastEndDate,
      totalExpectedCharges: forecast.reduce((sum, day) => sum + day.expectedCharges, 0),
      totalExpectedAmount: forecast.reduce((sum, day) => sum + day.expectedAmount, 0),
      daily: forecast,
      upcomingCharges: {
        items: upcomingCharges.slice(
          (query.upcomingPage - 1) * query.upcomingPageSize,
          query.upcomingPage * query.upcomingPageSize,
        ),
        pagination: {
          page: query.upcomingPage,
          pageSize: query.upcomingPageSize,
          total: upcomingCharges.length,
          pageCount: Math.ceil(upcomingCharges.length / query.upcomingPageSize),
        },
      },
    },
  }
}
