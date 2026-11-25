import { env } from '../../../config/env'
import { HttpError } from '../../../shared/http-error'

export type Recurrence = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

const recurrenceSettings: Record<Recurrence, { frequency: number; frequencyType: 'days' | 'months' }> = {
  WEEKLY: { frequency: 7, frequencyType: 'days' },
  MONTHLY: { frequency: 1, frequencyType: 'months' },
  QUARTERLY: { frequency: 3, frequencyType: 'months' },
  YEARLY: { frequency: 12, frequencyType: 'months' },
}

export function getSubscriptionsWebhookUrl() {
  return new URL('/api/subscriptions/webhook', env.API_PUBLIC_URL).toString()
}

export function getSubscriptionBackUrl() {
  return env.MP_SUBSCRIPTIONS_BACK_URL
}

export async function mercadoPagoSubscriptionRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = env.MP_SUBSCRIPTIONS_ACCESS_TOKEN ?? env.MP_ACCESS_TOKEN
  if (!accessToken) {
    throw new HttpError(503, 'O Mercado Pago ainda não está configurado no servidor')
  }
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const responseBody = await response.text()
  if (!response.ok) {
    console.error('Mercado Pago subscription request failed', {
      path,
      method: init.method ?? 'GET',
      status: response.status,
      response: responseBody.slice(0, 2000),
    })
    throw new HttpError(502, 'Não foi possível concluir a operação de assinatura no Mercado Pago')
  }
  return JSON.parse(responseBody) as T
}

export function createProviderPlanPayload(input: {
  name: string
  recurrence: Recurrence
  amount: number
  backUrl: string
}) {
  const schedule = recurrenceSettings[input.recurrence]
  return {
    reason: input.name,
    auto_recurring: {
      frequency: schedule.frequency,
      frequency_type: schedule.frequencyType,
      transaction_amount: input.amount,
      currency_id: 'BRL',
    },
    back_url: input.backUrl,
  }
}

export function createProviderSubscriptionPayload(input: {
  providerPlanId: string
  recurrence: Recurrence
  amount: number
  cardToken: string
  payerEmail: string
  externalReference: string
  reason: string
  backUrl: string
  notificationUrl: string
}) {
  const schedule = recurrenceSettings[input.recurrence]
  return {
    preapproval_plan_id: input.providerPlanId,
    reason: input.reason,
    external_reference: input.externalReference,
    payer_email: input.payerEmail,
    card_token_id: input.cardToken,
    auto_recurring: {
      frequency: schedule.frequency,
      frequency_type: schedule.frequencyType,
      transaction_amount: input.amount,
      currency_id: 'BRL',
    },
    back_url: input.backUrl,
    notification_url: input.notificationUrl,
    status: 'authorized',
  }
}
