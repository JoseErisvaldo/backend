import type { Request, Response } from 'express'
import { paymentService } from '../service/payment.service'

export async function paymentWebhook(req: Request, res: Response) {
  const requestId = req.header("x-request-id");
  const orderId = String(
    req.query["data.id"] ?? req.body?.data?.id ?? req.body?.id ?? "unknown",
  );
  console.info("Mercado Pago webhook received", { requestId, orderId });

  try {
    await paymentService.processWebhook(
      req.body,
      req.query["data.id"],
      requestId,
      req.header("x-signature"),
    );
    console.info("Mercado Pago webhook processed", { requestId, orderId });
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Mercado Pago webhook processing failed", {
      requestId,
      orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
