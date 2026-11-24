import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../../config/env";
import { HttpError } from "../../../shared/http-error";
import { sensitiveResponseKeys } from "../constants/sensitive-response-keys.constant";
import {
  mercadoPagoOrderSchema,
  type MercadoPagoOrder,
} from "../schemas/mercado-pago.schemas";
import type { IdempotentPayment } from "./payment-idempotency";

export function assertProviderOrderMatchesPayment(
  order: MercadoPagoOrder,
  payment: Pick<
    IdempotentPayment,
    "amount" | "externalReference" | "items" | "paymentMethod"
  >,
  expectedInstallments?: number,
) {
  const currency = payment.items[0]?.currency;
  const providerPayment = order.transactions?.payments[0];
  const providerInstallments = providerPayment?.payment_method.installments;
  const installmentCount = expectedInstallments ?? providerInstallments;
  const permitsInstallmentSurcharge =
    payment.paymentMethod !== "pix" &&
    installmentCount !== undefined &&
    installmentCount > 1 &&
    (providerInstallments === undefined ||
      expectedInstallments === undefined ||
      providerInstallments === expectedInstallments);
  const orderAmount =
    order.total_amount == null ? null : new Prisma.Decimal(order.total_amount);
  const isPaid = ["processed", "approved", "accredited"].includes(
    order.status?.toLowerCase() ?? "",
  );
  const paidAmount =
    order.total_paid_amount == null
      ? null
      : new Prisma.Decimal(order.total_paid_amount);

  const orderAmountMatches = orderAmount?.equals(payment.amount) ||
    (permitsInstallmentSurcharge && orderAmount?.greaterThan(payment.amount));
  const paidAmountMatches = !isPaid ||
    !paidAmount ||
    paidAmount.equals(payment.amount) ||
    (permitsInstallmentSurcharge && paidAmount.greaterThan(payment.amount));

  if (
    order.external_reference !== payment.externalReference ||
    !currency ||
    order.currency !== currency ||
    !orderAmount ||
    !orderAmountMatches ||
    !paidAmountMatches
  ) {
    console.error("Mercado Pago order amount or currency mismatch", {
      expectedAmount: payment.amount.toFixed(2),
      orderAmount: order.total_amount ?? null,
      totalPaidAmount: order.total_paid_amount ?? null,
      expectedCurrency: currency ?? null,
      providerCurrency: order.currency ?? null,
      expectedInstallments: expectedInstallments ?? null,
      providerInstallments: providerInstallments ?? null,
    });
    throw new HttpError(
      502,
      "O valor ou a moeda do pedido no provedor não corresponde ao pagamento",
    );
  }

  if (
    permitsInstallmentSurcharge &&
    (orderAmount?.greaterThan(payment.amount) ||
      paidAmount?.greaterThan(payment.amount))
  ) {
    console.info("Mercado Pago installment surcharge validated", {
      expectedAmount: payment.amount.toFixed(2),
      orderAmount: order.total_amount ?? null,
      totalPaidAmount: order.total_paid_amount ?? null,
      installments: installmentCount,
    });
  }
}

export function serializeCreatedPayment(payment: IdempotentPayment) {
  const currency = payment.items[0]?.currency ?? "BRL";
  return {
    payment: {
      id: payment.id,
      status: payment.status,
      statusDetail: payment.statusDetail,
      amount: Number(payment.amount),
      productName:
        payment.items.length === 1
          ? payment.items[0].productName
          : `${payment.items.length} produtos`,
      items: payment.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.unitPrice) * item.quantity,
        currency: item.currency,
      })),
      currency,
      providerOrderId: payment.providerOrderId,
      paymentMethod: payment.paymentMethod,
      ...getPaymentDetails(payment.providerResponse, payment.createdAt),
    },
  };
}

export function getMercadoPagoAccessToken() {
  const accessToken = env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new HttpError(
      503,
      "O pagamento ainda não está configurado no servidor",
    );
  }
  return accessToken;
}

export function getPaymentDetails(providerResponse: unknown, createdAt?: Date) {
  const parsedOrder = mercadoPagoOrderSchema.safeParse(providerResponse);
  const order = parsedOrder.success ? parsedOrder.data : undefined;
  const providerPayment = parsedOrder.success
    ? order?.transactions?.payments[0]
    : undefined;
  const paymentMethod = providerPayment?.payment_method;
  const expiresAt =
    providerPayment?.date_of_expiration ??
    (paymentMethod?.id === "pix" && createdAt
      ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null);
  return {
    qrCode: paymentMethod?.qr_code ?? null,
    qrCodeBase64: paymentMethod?.qr_code_base64 ?? null,
    ticketUrl: paymentMethod?.ticket_url ?? null,
    expiresAt,
    providerOrderDetails: order
      ? {
          id: String(order.id),
          type: order.type ?? null,
          processingMode: order.processing_mode ?? null,
          status: order.status ?? null,
          statusDetail: order.status_detail ?? null,
          externalReference: order.external_reference ?? null,
          updatedAt: order.last_updated_date ?? null,
          currency: order.currency ?? null,
          captureMode: order.capture_mode ?? null,
          countryCode: order.country_code ?? null,
          createdAt: order.created_date ?? null,
          totalAmount:
            order.total_amount == null ? null : Number(order.total_amount),
          totalPaidAmount:
            order.total_paid_amount == null
              ? null
              : Number(order.total_paid_amount),
          payment: providerPayment
            ? {
                id:
                  providerPayment.id == null
                    ? null
                    : String(providerPayment.id),
                amount:
                  providerPayment.amount == null
                    ? null
                    : Number(providerPayment.amount),
                status: providerPayment.status ?? null,
                statusDetail: providerPayment.status_detail ?? null,
                referenceId: providerPayment.reference_id ?? null,
                expirationTime: providerPayment.expiration_time ?? null,
                method: paymentMethod?.id ?? null,
                methodType: paymentMethod?.type ?? null,
                installments: paymentMethod?.installments ?? null,
                installmentAmount: paymentMethod?.installment_amount == null
                  ? null
                  : Number(paymentMethod.installment_amount),
                expiresAt: providerPayment.date_of_expiration ?? null,
              }
            : null,
        }
      : null,
  };
}

function sanitizeProviderValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (Array.isArray(value)) return value.map(sanitizeProviderValue);
  if (typeof value === "object") {
    const sanitized: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, child] of Object.entries(value)) {
      sanitized[key] = sensitiveResponseKeys.has(key.toLowerCase())
        ? "[REDACTED]"
        : sanitizeProviderValue(child);
    }
    return sanitized;
  }
  throw new TypeError("Mercado Pago response is not valid JSON");
}

export function sanitizeProviderResponse(
  value: unknown,
): Prisma.InputJsonValue {
  const sanitized = sanitizeProviderValue(value);
  if (
    sanitized === null ||
    Array.isArray(sanitized) ||
    typeof sanitized !== "object"
  ) {
    throw new TypeError("Mercado Pago response must be a JSON object");
  }
  return sanitized;
}

export function verifyWebhookSignature(
  orderId: string,
  requestId: string | undefined,
  signature: string | undefined,
): boolean {
  if (!env.MP_WEBHOOK_SECRET || !requestId || !signature) return false;
  const fields = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  if (!fields.ts || !fields.v1) return false;

  const manifest = `id:${orderId.toLowerCase()};request-id:${requestId};ts:${fields.ts};`;
  const expected = createHmac("sha256", env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(fields.v1, "hex");
  } catch {
    return false;
  }
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
