CREATE TABLE "payment_items" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

INSERT INTO "payment_items" (
    "id",
    "paymentId",
    "productId",
    "productName",
    "quantity",
    "unitPrice",
    "currency"
)
SELECT
    payment."id",
    payment."id",
    payment."productId",
    product."name",
    1,
    payment."amount",
    product."currency"
FROM "payments" AS payment
JOIN "products" AS product ON product."id" = payment."productId";

CREATE UNIQUE INDEX "payment_items_paymentId_productId_key"
    ON "payment_items"("paymentId", "productId");
CREATE INDEX "payment_items_productId_idx" ON "payment_items"("productId");

ALTER TABLE "payment_items"
    ADD CONSTRAINT "payment_items_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_items"
    ADD CONSTRAINT "payment_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" DROP CONSTRAINT "payments_productId_fkey";
ALTER TABLE "payments" DROP COLUMN "productId";
