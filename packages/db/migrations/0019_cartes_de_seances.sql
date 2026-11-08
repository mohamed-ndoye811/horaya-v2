CREATE TYPE "public"."pass_movement_kind" AS ENUM('purchase', 'use', 'recredit', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."pass_status" AS ENUM('pending', 'active', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."booking_payment_status" ADD VALUE 'paid_with_pass';--> statement-breakpoint
CREATE TABLE "pass" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" uuid,
	"name" text NOT NULL,
	"sessions_total" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"event_type_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" "pass_status" DEFAULT 'pending' NOT NULL,
	"source" "booking_source" NOT NULL,
	"payment_method" "payment_method",
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pass_movement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"pass_id" uuid NOT NULL,
	"kind" "pass_movement_kind" NOT NULL,
	"delta" integer NOT NULL,
	"booking_id" uuid,
	"reason" text,
	"actor_type" "actor_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pass_movement_delta_nonzero" CHECK ("pass_movement"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "pass_plan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sessions" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"event_type_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pass_plan_sessions_positive" CHECK ("pass_plan"."sessions" > 0),
	CONSTRAINT "pass_plan_validity_positive" CHECK ("pass_plan"."validity_days" > 0)
);
--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_plan_id_pass_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."pass_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_movement" ADD CONSTRAINT "pass_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_movement" ADD CONSTRAINT "pass_movement_pass_id_pass_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."pass"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_movement" ADD CONSTRAINT "pass_movement_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_plan" ADD CONSTRAINT "pass_plan_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pass_organization_id_status_index" ON "pass" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "pass_customer_id_index" ON "pass" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "pass_movement_pass_id_created_at_index" ON "pass_movement" USING btree ("pass_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pass_movement_booking_kind_unique" ON "pass_movement" USING btree ("booking_id","kind");--> statement-breakpoint
CREATE INDEX "pass_plan_organization_id_index" ON "pass_plan" USING btree ("organization_id");