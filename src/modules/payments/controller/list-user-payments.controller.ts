import type { Request, Response } from 'express'
import { listPaymentsQuerySchema } from '../schemas/list-user-payments.schemas'
import { paymentService } from '../service/payment.service'

export async function listPayments(req: Request, res: Response) {
  const { page, pageSize } = listPaymentsQuerySchema.parse(req.query);
  const result = await paymentService.listByUser(req.userId!, page, pageSize);
  res.status(200).json(result);
}
