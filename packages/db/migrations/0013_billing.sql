CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."billing_rate" AS ENUM('standard', 'solidaire', 'beta');--> statement-breakpoint
CREATE TYPE "public"."plan_grant_kind" AS ENUM('trial', 'beta', 'gift');--> statement-breakpoint
CREATE TYPE "public"."plan_id" AS ENUM('libre', 'pro', 'equipe');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "billing" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"rate" "billing_rate" DEFAULT 'standard' NOT NULL,
	"plan" "plan_id",
	"interval" "billing_interval",
	"status" "subscription_status",
	"polar_customer_id" text,
	"polar_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_polarCustomerId_unique" UNIQUE("polar_customer_id")
);
--> statement-breakpoint
CREATE TABLE "plan_grant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "plan_grant_kind" NOT NULL,
	"plan" "plan_id" NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing" ADD CONSTRAINT "billing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grant" ADD CONSTRAINT "plan_grant_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_grant_organization_id_index" ON "plan_grant" USING btree ("organization_id");--> statement-breakpoint
-- Espaces créés avant le lot 24 : formule BT (Pro offert pendant la bêta, sans fin).
INSERT INTO "plan_grant" ("id", "organization_id", "kind", "plan", "reason")
SELECT gen_random_uuid(), "id", 'beta', 'pro', 'Espace créé avant les abonnements' FROM "organization";
