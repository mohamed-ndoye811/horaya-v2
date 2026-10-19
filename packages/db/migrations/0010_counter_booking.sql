CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'check', 'transfer');--> statement-breakpoint
ALTER TABLE "customer" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "method" "payment_method";