import type { Request, Response } from 'express'
import { HttpError } from '../../../shared/http-error'
import {
  createPlan,
  createSubscription,
  deactivatePlan,
  listAdminPlans,
  listAllSubscriptions,
  listPublicPlans,
  listUserSubscriptions,
  cancelUserSubscription,
  processSubscriptionWebhook,
  updatePlan,
} from '../service/subscription.service'
import {
  createSubscriptionSchema,
  planIdSchema,
  planInputSchema,
  subscriptionWebhookSchema,
} from '../schemas/subscription.schemas'

export const subscriptionController = {
  async listPublicPlans(_req: Request, res: Response) {
    res.json({ plans: await listPublicPlans() })
  },
  async listAdminPlans(_req: Request, res: Response) {
    res.json({ plans: await listAdminPlans() })
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
  async listAllSubscriptions(_req: Request, res: Response) {
    res.json({ subscriptions: await listAllSubscriptions() })
  },
  async webhook(req: Request, res: Response) {
    const payload = subscriptionWebhookSchema.parse(req.body)
    const resourceId = req.query['data.id']?.toString() ?? payload.data?.id?.toString() ?? payload.id?.toString()
    await processSubscriptionWebhook({
      payload,
      requestId: req.header('x-request-id'),
      signature: req.header('x-signature'),
      resourceId,
      topic: req.query.type?.toString() ?? req.query.topic?.toString() ?? payload.type ?? payload.topic,
    })
    res.status(200).json({ received: true })
  },
}
