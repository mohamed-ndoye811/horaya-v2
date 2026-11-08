ALTER TABLE "event" ADD COLUMN "modules" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "minimum_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "minimum_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "follow_up_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_type" ADD COLUMN "modules" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Reprise des données (lot 34). Les anciens réglages du type deviennent ses modules : même
-- conversion que legacyModules du core (vérifiée par packages/db/test/modules.test.ts).
UPDATE "event_type" SET "modules" = jsonb_strip_nulls(jsonb_build_object(
	'places', CASE WHEN "default_capacity" IS NOT NULL OR "booking_rules"->'maxSeatsPerBooking' IS NOT NULL
		THEN jsonb_build_object('capacity', "default_capacity", 'maxPerBooking', "booking_rules"->'maxSeatsPerBooking') END,
	'waitlist', CASE WHEN coalesce(("booking_rules"->>'waitlistEnabled')::boolean, false) THEN '{}'::jsonb END,
	'approval', CASE WHEN "requires_approval" THEN '{}'::jsonb END,
	'opening', CASE WHEN coalesce(("booking_rules"->>'minAdvanceHours')::int, 0) > 0
		THEN jsonb_build_object('closesHoursBefore', ("booking_rules"->>'minAdvanceHours')::int) END
));--> statement-breakpoint
-- Chaque événement garde la version des modules de son type (jusqu'ici lus en direct sur le type).
UPDATE "event" SET "modules" = "event_type"."modules"
FROM "event_type" WHERE "event_type"."id" = "event"."event_type_id";--> statement-breakpoint
ALTER TABLE "event_type" DROP COLUMN "default_capacity";--> statement-breakpoint
ALTER TABLE "event_type" DROP COLUMN "requires_approval";--> statement-breakpoint
ALTER TABLE "event_type" DROP COLUMN "booking_rules";