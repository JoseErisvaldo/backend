import type { Request, Response } from 'express'
import { listAdminPaymentsQuerySchema } from '../schemas/list-admin-payments.schemas'
import { paymentService } from '../service/payment.service'

export async function listAdminPayments(req: Request, res: Response) {
  const query = listAdminPaymentsQuerySchema.parse(req.query);
  const result = await paymentService.listForAdmin(query);
  res.status(200).json(result);
}
