import type { Request, Response } from 'express'
import { paymentService } from '../service/payment.service'
import { HttpError } from '../../../shared/http-error'

export async function getUserPayment(req: Request, res: Response) {
  const paymentId = req.params.paymentId;
  if (typeof paymentId !== "string") {
    throw new HttpError(400, "Identificador do pagamento inválido");
  }
  const result = await paymentService.getById(req.userId!, paymentId);
  res.status(200).json(result);
}
