-- Un exemplaire ne peut pas être occupé deux fois sur des périodes qui se chevauchent
-- (événement, location, maintenance ou blocage). Les allocations annulées ne comptent pas.
-- Période semi-ouverte [début, fin) : finir à 12h et recommencer à 12h est autorisé.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "item_allocation"
  ADD CONSTRAINT "item_allocation_no_overlap"
  EXCLUDE USING gist (
    "item_unit_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("cancelled_at" IS NULL);
