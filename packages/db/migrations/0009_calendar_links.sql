CREATE TYPE "public"."calendar_link_filter" AS ENUM('all', 'event_types', 'events');--> statement-breakpoint
CREATE TABLE "calendar_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"filter_mode" "calendar_link_filter" NOT NULL,
	"filter_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_link_organizationId_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "calendar_link" ADD CONSTRAINT "calendar_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;