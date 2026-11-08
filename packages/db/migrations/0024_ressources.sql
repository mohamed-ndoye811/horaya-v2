ALTER TABLE "event" ADD COLUMN "staff_member_id" uuid;--> statement-breakpoint
ALTER TABLE "item_allocation" ADD COLUMN "need_id" text;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_staff_member_id_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_staff_member_id_index" ON "event" USING btree ("staff_member_id");