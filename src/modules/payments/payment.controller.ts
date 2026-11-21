import type { Request, Response } from "express";
import {
  createPaymentSchema,
  listAdminPaymentsQuerySchema,
  listPaymentsQuerySchema,
  paymentIdSchema,
} from "./payment.schemas";
import { paymentService } from "./payment.service";
import { HttpError } from "../../shared/http-error";

export const paymentController = {
  async list(req: Request, res: Response) {
    const { page, pageSize } = listPaymentsQuerySchema.parse(req.query);
    const result = await paymentService.listByUser(req.userId!, page, pageSize);
    res.status(200).json(result);
  },

  async listForAdmin(req: Request, res: Response) {
    const { page, pageSize } = listAdminPaymentsQuerySchema.parse(req.query);
    const result = await paymentService.listForAdmin(page, pageSize);
    res.status(200).json(result);
  },

  async getByIdForAdmin(req: Request, res: Response) {
    const paymentId = paymentIdSchema.parse(req.params.paymentId);
    const result = await paymentService.getByIdForAdmin(paymentId);
    res.status(200).json(result);
  },

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
