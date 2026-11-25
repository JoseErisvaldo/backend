CREATE TYPE "SubscriptionTier" AS ENUM ('BASIC', 'SIMPLE', 'PRO');
CREATE TYPE "SubscriptionRecurrence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

CREATE TABLE "subscription_plans" (
  "id" TEXT NOT NULL,
  "tier" "SubscriptionTier" NOT NULL,
  "recurrence" "SubscriptionRecurrence" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "providerPlanId" TEXT,
  "checkoutUrl" TEXT,
  "providerResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "planTier" "SubscriptionTier" NOT NULL,
  "planRecurrence" "SubscriptionRecurrence" NOT NULL,
  "planAmount" DECIMAL(10,2) NOT NULL,
  "planCurrency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "externalReference" TEXT NOT NULL,
  "providerSubscriptionId" TEXT,
  "payerEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "nextPaymentDate" TIMESTAMP(3),
  "providerResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_charges" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "providerPaymentId" TEXT NOT NULL,
  "amount" DECIMAL(10,2),
  "currency" VARCHAR(3),
  "status" TEXT NOT NULL,
  "statusDetail" TEXT,
  "paidAt" TIMESTAMP(3),
  "providerResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plans_providerPlanId_key" ON "subscription_plans"("providerPlanId");
CREATE UNIQUE INDEX "subscription_plans_tier_recurrence_key" ON "subscription_plans"("tier", "recurrence");
CREATE INDEX "subscription_plans_active_tier_idx" ON "subscription_plans"("active", "tier");
CREATE UNIQUE INDEX "subscriptions_externalReference_key" ON "subscriptions"("externalReference");
CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_key" ON "subscriptions"("providerSubscriptionId");
CREATE INDEX "subscriptions_userId_createdAt_idx" ON "subscriptions"("userId", "createdAt");
CREATE INDEX "subscriptions_planId_status_idx" ON "subscriptions"("planId", "status");
CREATE UNIQUE INDEX "subscription_charges_providerPaymentId_key" ON "subscription_charges"("providerPaymentId");
CREATE INDEX "subscription_charges_subscriptionId_createdAt_idx" ON "subscription_charges"("subscriptionId", "createdAt");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_charges"
  ADD CONSTRAINT "subscription_charges_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
