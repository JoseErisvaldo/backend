import type { Request, Response } from 'express'
import { paymentIdSchema } from '../schemas/payment-common.schemas'
import { paymentService } from '../service/payment.service'

export async function getAdminPayment(req: Request, res: Response) {
  const paymentId = paymentIdSchema.parse(req.params.paymentId);
  const result = await paymentService.getByIdForAdmin(paymentId);
  res.status(200).json(result);
}
