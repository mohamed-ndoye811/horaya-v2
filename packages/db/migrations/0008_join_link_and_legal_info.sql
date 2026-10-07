CREATE TABLE "join_link" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"role" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "join_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "siret" text;--> statement-breakpoint
ALTER TABLE "join_link" ADD CONSTRAINT "join_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_link" ADD CONSTRAINT "join_link_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;