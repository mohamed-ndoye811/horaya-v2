CREATE TYPE "public"."actor_type" AS ENUM('member', 'customer', 'system');--> statement-breakpoint
CREATE TYPE "public"."allocation_kind" AS ENUM('event', 'rental', 'maintenance', 'block');--> statement-breakpoint
CREATE TYPE "public"."booking_kind" AS ENUM('event', 'rental');--> statement-breakpoint
CREATE TYPE "public"."booking_payment_status" AS ENUM('none', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('public_page', 'admin', 'api');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'refused', 'cancelled', 'waitlisted');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('public', 'invite_only');--> statement-breakpoint
CREATE TYPE "public"."item_unit_status" AS ENUM('available', 'maintenance', 'retired');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('charge', 'deposit', 'balance', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('free', 'online', 'deposit', 'on_site');--> statement-breakpoint
CREATE TYPE "public"."payment_record_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stripe_account_status" AS ENUM('not_connected', 'pending', 'active', 'restricted');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"kind" "booking_kind" DEFAULT 'event' NOT NULL,
	"event_id" uuid,
	"customer_id" uuid NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"status" "booking_status" NOT NULL,
	"rental_starts_at" timestamp with time zone,
	"rental_ends_at" timestamp with time zone,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'free' NOT NULL,
	"payment_status" "booking_payment_status" DEFAULT 'none' NOT NULL,
	"deposit_cents" integer,
	"customer_message" text,
	"refusal_reason" text,
	"source" "booking_source" NOT NULL,
	"manage_token_hash" text,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_organizationId_reference_unique" UNIQUE("organization_id","reference"),
	CONSTRAINT "booking_seats_positive" CHECK ("booking"."seats" > 0),
	CONSTRAINT "booking_amount_positive" CHECK ("booking"."amount_cents" >= 0),
	CONSTRAINT "booking_kind_target" CHECK (("booking"."kind" = 'event' AND "booking"."event_id" IS NOT NULL)
        OR ("booking"."kind" = 'rental' AND "booking"."rental_starts_at" IS NOT NULL
            AND "booking"."rental_ends_at" > "booking"."rental_starts_at"))
);
--> statement-breakpoint
CREATE TABLE "booking_participant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"custom_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"status" "payment_record_status" NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_providerReference_unique" UNIQUE("provider","provider_reference"),
	CONSTRAINT "payment_amount_positive" CHECK ("payment"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"anonymized_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_note" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"author_member_id" uuid,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"series_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"visibility" "event_visibility" DEFAULT 'public' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"location_name" text,
	"location_address" text,
	"online_url" text,
	"capacity" integer,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'free' NOT NULL,
	"deposit_percent" integer,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"highlights" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_image_url" text,
	"published_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_organizationId_slug_unique" UNIQUE("organization_id","slug"),
	CONSTRAINT "event_period_valid" CHECK ("event"."ends_at" > "event"."starts_at"),
	CONSTRAINT "event_capacity_positive" CHECK ("event"."capacity" IS NULL OR "event"."capacity" > 0),
	CONSTRAINT "event_price_positive" CHECK ("event"."price_cents" >= 0),
	CONSTRAINT "event_deposit_percent_range" CHECK ("event"."deposit_percent" IS NULL OR ("event"."deposit_percent" > 0 AND "event"."deposit_percent" <= 100))
);
--> statement-breakpoint
CREATE TABLE "event_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_series" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"rrule" text NOT NULL,
	"until" timestamp with time zone,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"description" text,
	"default_duration_minutes" integer,
	"default_price_cents" integer,
	"default_capacity" integer,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"custom_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_type_organizationId_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_type_id" uuid,
	"name" text NOT NULL,
	"reference" text NOT NULL,
	"description" text,
	"daily_rate_cents" integer,
	"deposit_cents" integer,
	"storage_location" text,
	"purchased_on" date,
	"purchase_price_cents" integer,
	"photo_url" text,
	"rentable" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_organizationId_reference_unique" UNIQUE("organization_id","reference")
);
--> statement-breakpoint
CREATE TABLE "item_allocation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_unit_id" uuid NOT NULL,
	"kind" "allocation_kind" NOT NULL,
	"event_id" uuid,
	"booking_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"title" text,
	"provider" text,
	"cost_cents" integer,
	"note" text,
	"created_by_member_id" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_allocation_period_valid" CHECK ("item_allocation"."ends_at" > "item_allocation"."starts_at"),
	CONSTRAINT "item_allocation_kind_target" CHECK (("item_allocation"."kind" = 'event' AND "item_allocation"."event_id" IS NOT NULL)
        OR ("item_allocation"."kind" = 'rental' AND "item_allocation"."booking_id" IS NOT NULL)
        OR "item_allocation"."kind" IN ('maintenance', 'block'))
);
--> statement-breakpoint
CREATE TABLE "item_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_type_organizationId_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "item_unit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"label" text NOT NULL,
	"serial_number" text,
	"status" "item_unit_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_unit_itemId_label_unique" UNIQUE("item_id","label")
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	CONSTRAINT "notification_preference_memberId_notificationType_unique" UNIQUE("member_id","notification_type")
);
--> statement-breakpoint
CREATE TABLE "reference_counter" (
	"organization_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reference_counter_organization_id_scope_period_pk" PRIMARY KEY("organization_id","scope","period")
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"brand_color" text DEFAULT '#264489' NOT NULL,
	"description" text,
	"address" text,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"vat_rate_bps" integer DEFAULT 2000 NOT NULL,
	"default_deposit_percent" integer DEFAULT 30 NOT NULL,
	"free_cancellation_hours" integer DEFAULT 72 NOT NULL,
	"late_cancellation_refund_percent" integer DEFAULT 50 NOT NULL,
	"booking_reference_prefix" text DEFAULT 'HRY' NOT NULL,
	"stripe_account_id" text,
	"stripe_account_status" "stripe_account_status" DEFAULT 'not_connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participant" ADD CONSTRAINT "booking_participant_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_author_member_id_member_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_event_type_id_event_type_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_type" ADD CONSTRAINT "event_type_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_item_type_id_item_type_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_allocation" ADD CONSTRAINT "item_allocation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_allocation" ADD CONSTRAINT "item_allocation_item_unit_id_item_unit_id_fk" FOREIGN KEY ("item_unit_id") REFERENCES "public"."item_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_allocation" ADD CONSTRAINT "item_allocation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_allocation" ADD CONSTRAINT "item_allocation_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_allocation" ADD CONSTRAINT "item_allocation_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_type" ADD CONSTRAINT "item_type_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_unit" ADD CONSTRAINT "item_unit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_unit" ADD CONSTRAINT "item_unit_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_counter" ADD CONSTRAINT "reference_counter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "booking_organization_id_status_created_at_index" ON "booking" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "booking_event_id_status_index" ON "booking" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "booking_customer_id_index" ON "booking" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "booking_participant_booking_id_index" ON "booking_participant" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_booking_id_index" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_org_email_unique" ON "customer" USING btree ("organization_id",lower("email"));--> statement-breakpoint
CREATE INDEX "customer_organization_id_last_name_index" ON "customer" USING btree ("organization_id","last_name");--> statement-breakpoint
CREATE INDEX "customer_note_customer_id_created_at_index" ON "customer_note" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "event_organization_id_starts_at_index" ON "event" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "event_organization_id_status_index" ON "event" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "event_series_id_index" ON "event" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "event_media_event_id_position_index" ON "event_media" USING btree ("event_id","position");--> statement-breakpoint
CREATE INDEX "item_organization_id_item_type_id_index" ON "item" USING btree ("organization_id","item_type_id");--> statement-breakpoint
CREATE INDEX "item_allocation_item_unit_id_starts_at_index" ON "item_allocation" USING btree ("item_unit_id","starts_at");--> statement-breakpoint
CREATE INDEX "item_allocation_event_id_index" ON "item_allocation" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "item_allocation_booking_id_index" ON "item_allocation" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("organization_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_member_id_read_at_index" ON "notification" USING btree ("member_id","read_at");