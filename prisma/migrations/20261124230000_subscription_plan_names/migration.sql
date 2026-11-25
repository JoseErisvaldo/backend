ALTER TABLE "subscription_plans"
ADD COLUMN "name" VARCHAR(100) NOT NULL DEFAULT 'Plano';

UPDATE "subscription_plans"
SET "name" =
  CASE "tier"
    WHEN 'BASIC' THEN 'Básico'
    WHEN 'SIMPLE' THEN 'Simples'
    WHEN 'PRO' THEN 'Pro'
  END
  || ' - ' ||
  CASE "recurrence"
    WHEN 'WEEKLY' THEN 'Semanal'
    WHEN 'MONTHLY' THEN 'Mensal'
    WHEN 'QUARTERLY' THEN 'Trimestral'
    WHEN 'YEARLY' THEN 'Anual'
  END;

ALTER TABLE "subscription_plans"
ALTER COLUMN "name" DROP DEFAULT;

DROP INDEX "subscription_plans_tier_recurrence_key";

ALTER TABLE "subscriptions"
ADD COLUMN "planName" VARCHAR(100) NOT NULL DEFAULT 'Plano';

UPDATE "subscriptions" AS s
SET "planName" = p."name"
FROM "subscription_plans" AS p
WHERE s."planId" = p."id";

ALTER TABLE "subscriptions"
ALTER COLUMN "planName" DROP DEFAULT;
