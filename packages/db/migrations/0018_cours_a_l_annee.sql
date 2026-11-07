CREATE TABLE "series_enrollment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"paid_at" timestamp with time zone,
	"source" "booking_source" NOT NULL,
	"manage_token_hash" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_enrollment_manageTokenHash_unique" UNIQUE("manage_token_hash"),
	CONSTRAINT "series_enrollment_amount_positive" CHECK ("series_enrollment"."amount_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "enrollment_id" uuid;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "absent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "enrollment_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "enrollment_price_cents" integer;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "drop_in_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "series_enrollment" ADD CONSTRAINT "series_enrollment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_enrollment" ADD CONSTRAINT "series_enrollment_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_enrollment" ADD CONSTRAINT "series_enrollment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "series_enrollment_active_idx" ON "series_enrollment" USING btree ("series_id","customer_id") WHERE "series_enrollment"."cancelled_at" IS NULL;--> statement-breakpoint
CREATE INDEX "series_enrollment_customer_id_index" ON "series_enrollment" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_enrollment_id_series_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."series_enrollment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_enrollment_id_index" ON "booking" USING btree ("enrollment_id");