ALTER TABLE "booking" ADD COLUMN "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "field_values" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_type" ADD COLUMN "fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_type" ADD COLUMN "booking_noun" text DEFAULT 'reservation' NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "field_values" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "item_type" ADD COLUMN "fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Reprise des données (lot 33). Les anciens champs personnalisés deviennent des questions
-- « une fois par inscription » : même conversion que fromLegacyCustomField du core.
UPDATE "event_type" SET "fields" = coalesce((
	SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
		'key', f->>'key',
		'label', f->>'label',
		'type', CASE f->>'type' WHEN 'select' THEN 'choice' WHEN 'checkbox' THEN 'boolean' ELSE 'short_text' END,
		'scope', 'booking',
		'required', coalesce((f->>'required')::boolean, false),
		'options', CASE WHEN f->>'type' = 'select' THEN coalesce(f->'options', '[]'::jsonb) END
	)) ORDER BY ord)
	FROM jsonb_array_elements("event_type"."custom_fields") WITH ORDINALITY AS t(f, ord)
), '[]'::jsonb);--> statement-breakpoint
-- Chaque événement garde la version des champs de son type.
UPDATE "event" SET "fields" = "event_type"."fields"
FROM "event_type" WHERE "event_type"."id" = "event"."event_type_id";--> statement-breakpoint
-- Les réponses du premier participant (la personne qui réserve) passent sur l'inscription ;
-- celles des autres participants restent sur leur ligne.
UPDATE "booking" SET "answers" = "first"."custom_answers"
FROM (
	SELECT DISTINCT ON ("booking_id") "id", "booking_id", "custom_answers"
	FROM "booking_participant" ORDER BY "booking_id", "created_at", "id"
) AS "first"
WHERE "first"."booking_id" = "booking"."id" AND "first"."custom_answers" <> '{}'::jsonb;--> statement-breakpoint
UPDATE "booking_participant" SET "custom_answers" = '{}'::jsonb
WHERE "id" IN (
	SELECT DISTINCT ON ("booking_id") "id"
	FROM "booking_participant" ORDER BY "booking_id", "created_at", "id"
);--> statement-breakpoint
ALTER TABLE "booking_participant" RENAME COLUMN "custom_answers" TO "answers";--> statement-breakpoint
ALTER TABLE "event_type" DROP COLUMN "custom_fields";
