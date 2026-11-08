CREATE TYPE "public"."gift_card_movement_kind" AS ENUM('issue', 'use', 'restore', 'cancel', 'adjust');--> statement-breakpoint
CREATE TYPE "public"."gift_card_source" AS ENUM('public_page', 'admin', 'counter');--> statement-breakpoint
CREATE TYPE "public"."gift_card_status" AS ENUM('pending', 'active', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'gift_card';--> statement-breakpoint
CREATE TABLE "gift_card" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "gift_card_status" DEFAULT 'pending' NOT NULL,
	"initial_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"purchaser_name" text NOT NULL,
	"purchaser_email" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_email" text,
	"message" text,
	"source" "gift_card_source" NOT NULL,
	"view_token" text NOT NULL,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_card_organizationId_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "gift_card_viewToken_unique" UNIQUE("view_token"),
	CONSTRAINT "gift_card_amount_positive" CHECK ("gift_card"."initial_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "gift_card_movement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"gift_card_id" uuid NOT NULL,
	"kind" "gift_card_movement_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"booking_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_card_movement_not_zero" CHECK ("gift_card_movement"."amount_cents" <> 0)
);
--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "gift_cards" jsonb;--> statement-breakpoint
ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_movement" ADD CONSTRAINT "gift_card_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_movement" ADD CONSTRAINT "gift_card_movement_gift_card_id_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_movement" ADD CONSTRAINT "gift_card_movement_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_card_organization_id_created_at_index" ON "gift_card" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "gift_card_organization_id_purchaser_email_index" ON "gift_card" USING btree ("organization_id","purchaser_email");--> statement-breakpoint
CREATE INDEX "gift_card_organization_id_recipient_email_index" ON "gift_card" USING btree ("organization_id","recipient_email");--> statement-breakpoint
CREATE INDEX "gift_card_movement_gift_card_id_created_at_index" ON "gift_card_movement" USING btree ("gift_card_id","created_at");--> statement-breakpoint
CREATE INDEX "gift_card_movement_booking_id_index" ON "gift_card_movement" USING btree ("booking_id");