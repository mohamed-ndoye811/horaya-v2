CREATE TABLE "slot_hold" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"duration_id" text,
	"staff_member_id" uuid,
	"event_id" uuid,
	"seats" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_hold_period_valid" CHECK ("slot_hold"."ends_at" > "slot_hold"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "series_enrollment" ADD COLUMN "price_lines" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "from_slot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "session_topic" text;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "kind" text DEFAULT 'recurrence' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "enrollment_prices" jsonb;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "same_equipment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "slot_hold" ADD CONSTRAINT "slot_hold_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_hold" ADD CONSTRAINT "slot_hold_event_type_id_event_type_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_hold" ADD CONSTRAINT "slot_hold_staff_member_id_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_hold" ADD CONSTRAINT "slot_hold_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slot_hold_organization_id_expires_at_index" ON "slot_hold" USING btree ("organization_id","expires_at");--> statement-breakpoint
CREATE INDEX "event_event_type_id_starts_at_index" ON "event" USING btree ("event_type_id","starts_at") WHERE "event"."from_slot";--> statement-breakpoint
-- Module Créneaux : un intervenant n'anime jamais deux créneaux qui se chevauchent, et sans
-- intervenant, un type n'a jamais deux créneaux en même temps (les autres réservent l'événement
-- existant). Même garantie que le matériel (`item_allocation_no_overlap`), sous concurrence.
ALTER TABLE "event"
  ADD CONSTRAINT "event_slot_staff_no_overlap"
  EXCLUDE USING gist (
    "staff_member_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("from_slot" AND "staff_member_id" IS NOT NULL AND "status" <> 'cancelled');
--> statement-breakpoint
ALTER TABLE "event"
  ADD CONSTRAINT "event_slot_type_no_overlap"
  EXCLUDE USING gist (
    "event_type_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("from_slot" AND "staff_member_id" IS NULL AND "status" <> 'cancelled');
