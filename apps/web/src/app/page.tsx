import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-8 bg-ink px-6 text-on-ink sm:px-24">
      <span className="font-mono text-label uppercase tracking-[0.06em] opacity-75">
        Refonte v2 · aperçu
      </span>
      <h1 className="font-headline text-[96px] leading-[0.85] sm:text-[160px]">Horaya</h1>
      <p className="max-w-xl text-lg font-medium opacity-90">
        Réservations, événements et matériel dans un seul agenda, sous ta marque.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/inscription" className={buttonClasses({ variant: "inverse", size: "lg" })}>
          Créer un espace
        </Link>
        <Link
          href="/connexion"
          className={buttonClasses({ variant: "inverse-outline", size: "lg" })}
        >
          Se connecter
        </Link>
      </div>
    </main>
  );
}
