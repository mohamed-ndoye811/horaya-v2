ALTER TABLE "booking" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_participant" DROP COLUMN "checked_in_at";