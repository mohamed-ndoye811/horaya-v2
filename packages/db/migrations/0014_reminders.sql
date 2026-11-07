ALTER TABLE "booking" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "reminder_sent_at" timestamp with time zone;