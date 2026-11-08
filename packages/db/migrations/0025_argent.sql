ALTER TABLE "event" DROP CONSTRAINT "event_deposit_percent_range";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "price_lines" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Reprise des données (lot 35). Le prix d'un type ou d'un événement payant devient un tarif
-- « Plein » unique (module « Tarifs et options ») ; l'acompte de l'événement devient son module
-- « Acompte », le reste sur place comme avant. Les réservations existantes gardent leur montant
-- (détail vide). Vérifié par packages/db/test/money.test.ts.
UPDATE "event_type" SET "modules" = "modules" || jsonb_build_object('pricing', jsonb_build_object(
	'rates', jsonb_build_array(jsonb_build_object('id', 'plein', 'name', 'Plein', 'priceCents', "default_price_cents"))
))
WHERE "default_price_cents" > 0 AND NOT "modules" ? 'pricing';--> statement-breakpoint
UPDATE "event" SET "modules" = "modules" || jsonb_build_object('pricing', jsonb_build_object(
	'rates', jsonb_build_array(jsonb_build_object('id', 'plein', 'name', 'Plein', 'priceCents', "price_cents"))
))
WHERE "price_cents" > 0 AND NOT "modules" ? 'pricing';--> statement-breakpoint
UPDATE "event" SET "modules" = "modules" || jsonb_build_object('deposit', jsonb_build_object(
	'percent', "deposit_percent", 'balance', 'on_site'
))
WHERE "deposit_percent" IS NOT NULL AND "deposit_percent" < 100;--> statement-breakpoint
-- Un acompte de 100 % : c'est un paiement en ligne de tout le montant.
UPDATE "event" SET "payment_mode" = 'online' WHERE "deposit_percent" = 100;--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "deposit_percent";