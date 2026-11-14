import type { Request, Response } from "express";
import { createPaymentSchema } from "./payment.schemas";
import { paymentService } from "./payment.service";
import { HttpError } from "../../shared/http-error";

export const paymentController = {
  async getById(req: Request, res: Response) {
    const paymentId = req.params.paymentId;
    if (typeof paymentId !== "string") {
      throw new HttpError(400, "Identificador do pagamento inválido");
    }
    const result = await paymentService.getById(req.userId!, paymentId);
    res.status(200).json(result);
  },

  async create(req: Request, res: Response) {
    const input = createPaymentSchema.parse(req.body);
    const result = await paymentService.create(req.userId!, input);
    res.status(201).json(result);
  },

  async webhook(req: Request, res: Response) {
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
  },
};
