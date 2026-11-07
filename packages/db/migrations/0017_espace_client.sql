CREATE TABLE "customer_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"calendar_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_account_email_unique" UNIQUE("email"),
	CONSTRAINT "customer_account_calendarToken_unique" UNIQUE("calendar_token")
);
--> statement-breakpoint
CREATE TABLE "customer_login_link" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organization_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_session" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_login_link" ADD CONSTRAINT "customer_login_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_session" ADD CONSTRAINT "customer_session_account_id_customer_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_login_link_expires_at_index" ON "customer_login_link" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_session_account_id_index" ON "customer_session" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "customer_session_expires_at_index" ON "customer_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_email_lower_idx" ON "customer" USING btree (lower("email"));