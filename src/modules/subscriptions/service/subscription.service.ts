import { randomUUID } from 'node:crypto'
import { Role, type Prisma, type SubscriptionPlan } from '@prisma/client'
import { env } from '../../../config/env'
import { HttpError } from '../../../shared/http-error'
import { prisma } from '../../../shared/prisma'
import { providerJson, getProviderDate, getRemainingChargeTime, verifySubscriptionWebhookSignature } from '../helpers/subscription.shared'
import {
  createProviderPlanPayload,
  createProviderSubscriptionPayload,
  getSubscriptionBackUrl,
  getSubscriptionsWebhookUrl,
  mercadoPagoSubscriptionRequest,
  type Recurrence,
} from '../provider/mercado-pago'

type PlanInput = {
  name: string
  tier: 'BASIC' | 'SIMPLE' | 'PRO'
  recurrence: Recurrence
  amount: number
  active: boolean
}

type ProviderPlan = { id: string; init_point?: string; status?: string }
type ProviderSubscription = {
  id: string | number
  status?: string
  next_payment_date?: string
  external_reference?: string
  init_point?: string
}
type ProviderAuthorizedPayment = {
  id: string | number
  preapproval_id?: string | number
  transaction_amount?: number
  currency_id?: string
  date_approved?: string
  status_detail?: string
  payment?: { id?: string | number; status?: string; status_detail?: string; transaction_amount?: number; currency_id?: string; date_approved?: string }
  status?: string
}

const tierNames = { BASIC: 'Básico', SIMPLE: 'Simples', PRO: 'Pro' } as const
const recurrenceNames: Record<Recurrence, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
}
const planSelect = {
  id: true,
  name: true,
  tier: true,
  recurrence: true,
  amount: true,
  currency: true,
  active: true,
  providerPlanId: true,
  checkoutUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionPlanSelect

function providerReason(input: Pick<PlanInput, 'name'>) {
  return input.name
}

function serializePlan(plan: Pick<SubscriptionPlan, 'id' | 'tier' | 'recurrence' | 'amount' | 'currency' | 'active' | 'providerPlanId' | 'checkoutUrl' | 'createdAt' | 'updatedAt'>) {
  return { ...plan, amount: Number(plan.amount) }
}

function serializePublicPlan(plan: Parameters<typeof serializePlan>[0]) {
  const { providerPlanId: _providerPlanId, checkoutUrl: _checkoutUrl, ...publicPlan } = serializePlan(plan)
  return publicPlan
}

function safeProviderSubscription(response: ProviderSubscription) {
  return providerJson({
    id: response.id,
    status: response.status ?? null,
    external_reference: response.external_reference ?? null,
    next_payment_date: response.next_payment_date ?? null,
    init_point: response.init_point ?? null,
  })
}

function safeProviderAuthorizedPayment(payment: ProviderAuthorizedPayment) {
  return providerJson({
    id: payment.id,
    preapproval_id: payment.preapproval_id ?? null,
    status: payment.status ?? null,
    status_detail: payment.status_detail ?? null,
    transaction_amount: payment.transaction_amount ?? null,
    currency_id: payment.currency_id ?? null,
    date_approved: payment.date_approved ?? null,
    payment: payment.payment
      ? {
          id: payment.payment.id ?? null,
          status: payment.payment.status ?? null,
          status_detail: payment.payment.status_detail ?? null,
          transaction_amount: payment.payment.transaction_amount ?? null,
          currency_id: payment.payment.currency_id ?? null,
          date_approved: payment.payment.date_approved ?? null,
        }
      : null,
  })
}

async function createProviderPlan(input: PlanInput) {
  const response = await mercadoPagoSubscriptionRequest<ProviderPlan>('/preapproval_plan', {
    method: 'POST',
    body: JSON.stringify({
      ...createProviderPlanPayload({
        name: providerReason(input),
        recurrence: input.recurrence,
        amount: input.amount,
        backUrl: getSubscriptionBackUrl(),
      }),
    }),
  })
  if (!response.id) throw new HttpError(502, 'O Mercado Pago não retornou o identificador do plano')
  return response
}

export async function listAdminPlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    select: planSelect,
    orderBy: [{ tier: 'asc' }, { recurrence: 'asc' }, { name: 'asc' }],
  })
  return plans.map(serializePlan)
}

export async function listPublicPlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { active: true, providerPlanId: { not: null } },
    select: planSelect,
    orderBy: [{ tier: 'asc' }, { recurrence: 'asc' }, { name: 'asc' }],
  })
  return plans.map(serializePublicPlan)
}

export async function createPlan(input: PlanInput) {
  const providerPlan = await createProviderPlan(input)
  const plan = await prisma.subscriptionPlan.create({
    data: {
      ...input,
      providerPlanId: String(providerPlan.id),
      checkoutUrl: providerPlan.init_point ?? null,
      providerResponse: providerJson(providerPlan),
    },
    select: planSelect,
  })
  return serializePlan(plan)
}

export async function updatePlan(id: string, input: PlanInput) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } })
  if (!plan) throw new HttpError(404, 'Plano não encontrado')
  let providerPlan: ProviderPlan | null = null
  if (
    !plan.providerPlanId ||
    plan.name !== input.name ||
    Number(plan.amount) !== input.amount ||
    plan.tier !== input.tier ||
    plan.recurrence !== input.recurrence
  ) {
    providerPlan = await createProviderPlan(input)
  }
  const updated = await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...input,
      ...(providerPlan ? {
        providerPlanId: String(providerPlan.id),
        checkoutUrl: providerPlan.init_point ?? null,
        providerResponse: providerJson(providerPlan),
      } : {}),
    },
    select: planSelect,
  })
  return serializePlan(updated)
}

export async function deactivatePlan(id: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id }, select: { id: true } })
  if (!plan) throw new HttpError(404, 'Plano não encontrado')
  await prisma.subscriptionPlan.update({ where: { id }, data: { active: false } })
}

export async function createSubscription(userId: string, input: { planId: string; cardToken: string }) {
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
    prisma.subscriptionPlan.findUnique({ where: { id: input.planId } }),
  ])
  if (!user) throw new HttpError(404, 'Usuário não encontrado')
  if (!plan?.active || !plan.providerPlanId) throw new HttpError(404, 'Plano indisponível')
  const notificationUrl = getSubscriptionsWebhookUrl()
  const id = randomUUID()
  const externalReference = `subscription:${id}`
  const reason = providerReason({ name: plan.name })
  const localSubscription = await prisma.subscription.create({
    data: {
      id,
      userId,
      planId: plan.id,
      planName: plan.name,
      planTier: plan.tier,
      planRecurrence: plan.recurrence,
      planAmount: plan.amount,
      planCurrency: plan.currency,
      externalReference,
      payerEmail: user.email,
      status: 'creating',
    },
  })

  try {
    const response = await mercadoPagoSubscriptionRequest<ProviderSubscription>('/preapproval', {
      method: 'POST',
      body: JSON.stringify(createProviderSubscriptionPayload({
        providerPlanId: plan.providerPlanId,
        recurrence: plan.recurrence,
        amount: Number(plan.amount),
        cardToken: input.cardToken,
        payerEmail: user.email,
        externalReference,
        reason,
        backUrl: getSubscriptionBackUrl(),
        notificationUrl,
      })),
    })
    const subscription = await prisma.subscription.update({
      where: { id: localSubscription.id },
      data: {
        providerSubscriptionId: String(response.id),
        status: response.status ?? 'pending',
        nextPaymentDate: getProviderDate(response.next_payment_date),
        providerResponse: safeProviderSubscription(response),
      },
    })
    return {
      id: subscription.id,
      status: subscription.status,
      initPoint: response.init_point ?? null,
      nextPaymentDate: subscription.nextPaymentDate,
    }
  } catch (error) {
    await prisma.subscription.update({
      where: { id: localSubscription.id },
      data: { status: 'error' },
    })
    throw error
  }
}

export async function listUserSubscriptions(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: {
      plan: { select: planSelect },
      charges: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
    orderBy: { createdAt: 'desc' },
  })
  return subscriptions.map(({ plan, planName, planTier, planRecurrence, planAmount, planCurrency, charges, id, status, nextPaymentDate, createdAt, updatedAt }) => ({
    id,
    status,
    nextPaymentDate,
    nextPaymentCountdown: getRemainingChargeTime(nextPaymentDate),
    createdAt,
    updatedAt,
    plan: { ...serializePlan(plan), name: planName, tier: planTier, recurrence: planRecurrence, amount: Number(planAmount), currency: planCurrency },
    charges: charges.map((charge) => ({
      id: charge.id,
      providerPaymentId: charge.providerPaymentId,
      status: charge.status,
      statusDetail: charge.statusDetail,
      currency: charge.currency,
      paidAt: charge.paidAt,
      createdAt: charge.createdAt,
      amount: charge.amount === null ? null : Number(charge.amount),
    })),
  }))
}

export async function cancelUserSubscription(userId: string, id: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
  })
  if (!subscription) throw new HttpError(404, 'Assinatura não encontrada')
  if (!subscription.providerSubscriptionId) throw new HttpError(409, 'A assinatura ainda não foi autorizada pelo Mercado Pago')
  if (subscription.status === 'canceled' || subscription.status === 'cancelled') return

  const response = await mercadoPagoSubscriptionRequest<ProviderSubscription>(
    `/preapproval/${encodeURIComponent(subscription.providerSubscriptionId)}`,
    { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) },
  )
  await prisma.subscription.update({
    where: { id },
    data: {
      status: response.status ?? 'cancelled',
      providerResponse: safeProviderSubscription(response),
      nextPaymentDate: getProviderDate(response.next_payment_date),
    },
  })
}

export async function processSubscriptionWebhook(input: {
  payload: unknown
  requestId?: string
  signature?: string
  resourceId?: string
  topic?: string
}): Promise<'subscription_updated' | 'charge_upserted' | 'ignored'> {
  const webhookSecret = env.MP_SUBSCRIPTIONS_WEBHOOK_SECRET
  const body = input.payload as { type?: string; action?: string; data?: { id?: string | number }; id?: string | number }
  const resourceId = input.resourceId ?? body?.data?.id?.toString() ?? body?.id?.toString()
  if (!resourceId || resourceId.length > 100) throw new HttpError(400, 'Identificador de notificação inválido')
  if (!verifySubscriptionWebhookSignature(resourceId, input.requestId, input.signature, webhookSecret)) {
    throw new HttpError(401, 'Assinatura de webhook de assinaturas inválida')
  }
  const topic = input.topic ?? body?.type
  if (topic === 'subscription_preapproval') {
    const providerSubscription = await mercadoPagoSubscriptionRequest<ProviderSubscription>(
      `/preapproval/${encodeURIComponent(resourceId)}`,
    )
    if (!providerSubscription.external_reference) return 'ignored'
    const subscription = await prisma.subscription.findUnique({
      where: { externalReference: providerSubscription.external_reference },
      select: { id: true, providerSubscriptionId: true },
    })
    if (!subscription) return 'ignored'
    if (subscription.providerSubscriptionId && subscription.providerSubscriptionId !== String(providerSubscription.id)) {
      throw new HttpError(409, 'A notificação não corresponde à assinatura local')
    }
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        providerSubscriptionId: String(providerSubscription.id),
        status: providerSubscription.status ?? 'pending',
        nextPaymentDate: getProviderDate(providerSubscription.next_payment_date),
        providerResponse: safeProviderSubscription(providerSubscription),
      },
    })
    return 'subscription_updated'
  }
  if (topic === 'subscription_authorized_payment') {
    const payment = await mercadoPagoSubscriptionRequest<ProviderAuthorizedPayment>(
      `/authorized_payments/${encodeURIComponent(resourceId)}`,
    )
    if (!payment.preapproval_id) return 'ignored'
    const subscription = await prisma.subscription.findUnique({
      where: { providerSubscriptionId: String(payment.preapproval_id) },
      select: { id: true },
    })
    const paymentId = String(payment.payment?.id ?? payment.id)
    if (!subscription || !paymentId) return 'ignored'
    await prisma.subscriptionCharge.upsert({
      where: { providerPaymentId: paymentId },
      create: {
        subscriptionId: subscription.id,
        providerPaymentId: paymentId,
        amount: payment.payment?.transaction_amount ?? payment.transaction_amount ?? undefined,
        currency: payment.payment?.currency_id ?? payment.currency_id ?? undefined,
        status: payment.payment?.status ?? payment.status ?? 'unknown',
        statusDetail: payment.payment?.status_detail ?? payment.status_detail,
        paidAt: getProviderDate(payment.payment?.date_approved ?? payment.date_approved),
        providerResponse: safeProviderAuthorizedPayment(payment),
      },
      update: {
        amount: payment.payment?.transaction_amount ?? payment.transaction_amount ?? undefined,
        currency: payment.payment?.currency_id ?? payment.currency_id ?? undefined,
        status: payment.payment?.status ?? payment.status ?? 'unknown',
        statusDetail: payment.payment?.status_detail ?? payment.status_detail,
        paidAt: getProviderDate(payment.payment?.date_approved ?? payment.date_approved),
        providerResponse: safeProviderAuthorizedPayment(payment),
      },
    })
    return 'charge_upserted'
  }
  return 'ignored'
}

export async function listAllSubscriptions() {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan: { select: planSelect },
      charges: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return subscriptions.map(({ plan, planName, planTier, planRecurrence, planAmount, planCurrency, charges, id, status, nextPaymentDate, createdAt, updatedAt, user }) => ({
    id,
    status,
    nextPaymentDate,
    nextPaymentCountdown: getRemainingChargeTime(nextPaymentDate),
    createdAt,
    updatedAt,
    user,
    plan: { ...serializePlan(plan), name: planName, tier: planTier, recurrence: planRecurrence, amount: Number(planAmount), currency: planCurrency },
    charges: charges.map((charge) => ({
      id: charge.id,
      providerPaymentId: charge.providerPaymentId,
      status: charge.status,
      statusDetail: charge.statusDetail,
      currency: charge.currency,
      paidAt: charge.paidAt,
      createdAt: charge.createdAt,
      amount: charge.amount === null ? null : Number(charge.amount),
    })),
  }))
}
