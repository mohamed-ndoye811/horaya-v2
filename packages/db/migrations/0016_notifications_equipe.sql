ALTER TABLE "event" ADD COLUMN "almost_full_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "weekly_digest_sent_at" timestamp with time zone;