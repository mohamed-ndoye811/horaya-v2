ALTER TABLE "booking" ADD COLUMN "makeup_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "makeup_for_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "enrollment_prorata" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "makeup_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_makeup_for_booking_id_booking_id_fk" FOREIGN KEY ("makeup_for_booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_makeup_active_idx" ON "booking" USING btree ("makeup_for_booking_id") WHERE "booking"."makeup_for_booking_id" IS NOT NULL AND "booking"."status" IN ('pending', 'confirmed');