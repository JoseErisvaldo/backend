import type { Request, Response } from 'express'
import { HttpError } from '../../../shared/http-error'
import {
  createPlan,
  createSubscription,
  deactivatePlan,
  listAdminPlans,
  listAllSubscriptions,
  listAdminCustomers,
  getAdminCustomerDetails,
  listPublicPlans,
  listUserSubscriptions,
  cancelUserSubscription,
  processSubscriptionWebhook,
  updatePlan,
} from '../service/subscription.service'
import {
  createSubscriptionSchema,
  adminPlansQuerySchema,
  adminSubscriptionsQuerySchema,
  adminCustomersQuerySchema,
  planIdSchema,
  planInputSchema,
  subscriptionWebhookSchema,
} from '../schemas/subscription.schemas'

export const subscriptionController = {
  async listPublicPlans(_req: Request, res: Response) {
    res.json({ plans: await listPublicPlans() })
  },
  async listAdminPlans(req: Request, res: Response) {
    res.json(await listAdminPlans(adminPlansQuerySchema.parse(req.query)))
  },
  async createPlan(req: Request, res: Response) {
    res.status(201).json({ plan: await createPlan(planInputSchema.parse(req.body)) })
  },
  async updatePlan(req: Request, res: Response) {
    res.json({ plan: await updatePlan(planIdSchema.parse(req.params.id), planInputSchema.parse(req.body)) })
  },
  async deactivatePlan(req: Request, res: Response) {
    await deactivatePlan(planIdSchema.parse(req.params.id))
    res.status(204).send()
  },
  async createSubscription(req: Request, res: Response) {
    if (!req.userId) throw new HttpError(401, 'Autenticação necessária')
    res.status(201).json({ subscription: await createSubscription(req.userId, createSubscriptionSchema.parse(req.body)) })
  },
  async listUserSubscriptions(req: Request, res: Response) {
    if (!req.userId) throw new HttpError(401, 'Autenticação necessária')
    res.json({ subscriptions: await listUserSubscriptions(req.userId) })
  },
  async cancelUserSubscription(req: Request, res: Response) {
    if (!req.userId) throw new HttpError(401, 'Autenticação necessária')
    await cancelUserSubscription(req.userId, planIdSchema.parse(req.params.id))
    res.status(204).send()
  },
  async listAllSubscriptions(req: Request, res: Response) {
    res.json(await listAllSubscriptions(adminSubscriptionsQuerySchema.parse(req.query)))
  },
  async listAdminCustomers(req: Request, res: Response) {
    res.json(await listAdminCustomers(adminCustomersQuerySchema.parse(req.query)))
  },
  async getAdminCustomerDetails(req: Request, res: Response) {
    res.json(await getAdminCustomerDetails(planIdSchema.parse(req.params.id)))
  },
  async webhook(req: Request, res: Response) {
    const rawPayload = req.body as { type?: unknown; topic?: unknown; action?: unknown } | null
    const topic = req.query.type ?? req.query.topic ?? rawPayload?.type ?? rawPayload?.topic
    const action = rawPayload?.action
    const eventLabel = (value: unknown) => typeof value === 'string'
      ? value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80)
      : undefined
    const safeTopic = eventLabel(topic)
    const safeAction = eventLabel(action)
    console.info('Mercado Pago subscription webhook received', {
      topic: safeTopic ?? 'unknown',
      action: safeAction ?? 'unknown',
    })

    try {
      const payload = subscriptionWebhookSchema.parse(req.body)
      const resourceId = req.query['data.id']?.toString() ?? payload.data?.id?.toString() ?? payload.id?.toString()
      const outcome = await processSubscriptionWebhook({
        payload,
        requestId: req.header('x-request-id'),
        signature: req.header('x-signature'),
        resourceId,
        topic: req.query.type?.toString() ?? req.query.topic?.toString() ?? payload.type ?? payload.topic,
      })
      console.info('Mercado Pago subscription webhook processed', {
        topic: safeTopic ?? 'unknown',
        action: safeAction ?? 'unknown',
        outcome,
      })
      res.status(200).json({ received: true })
    } catch (error) {
      console.error('Mercado Pago subscription webhook failed', {
        topic: safeTopic ?? 'unknown',
        action: safeAction ?? 'unknown',
        errorType: error instanceof HttpError ? `http_${error.statusCode}` : 'internal_error',
      })
      throw error
    }
  },
}
