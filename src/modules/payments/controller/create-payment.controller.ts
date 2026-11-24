import type { Request, Response } from 'express'
import { createPaymentSchema, paymentIdempotencyKeySchema } from '../schemas/create-payment.schemas'
import { paymentService } from '../service/payment.service'

export async function createPayment(req: Request, res: Response) {
  const input = createPaymentSchema.parse(req.body);
  const idempotencyKey = paymentIdempotencyKeySchema.parse(req.header("Idempotency-Key"));
  const result = await paymentService.create(req.userId!, input, idempotencyKey);
  res.status(201).json(result);
}
