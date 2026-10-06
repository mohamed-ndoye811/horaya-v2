export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 bg-ink px-24 text-on-ink">
      <span className="font-mono text-label uppercase tracking-[0.06em] opacity-75">
        Refonte v2 · fondations
      </span>
      <h1 className="font-headline text-[160px] leading-[0.85]">Horaya</h1>
      <p className="max-w-xl text-lg font-medium opacity-90">
        Réservations, événements et matériel dans un seul agenda, sous ta marque.
      </p>
    </main>
  );
}
