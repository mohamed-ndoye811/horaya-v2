import type { ReactNode } from "react";
import { HorayaWordmark } from "@/components/app/logo";
import { Link } from "@/lib/navigation";

export const CONTACT = "bonjour@horaya.app";

const LEGAL_LINKS = [
  { href: "/aide", label: "Aide" },
  { href: "/cgu", label: "Conditions d'utilisation" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
];

/** Cadre des pages légales d'Horaya : marque, titre, introduction, blocs, liens entre les pages. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-bg px-4 py-10 sm:py-16">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <Link href="/" className="w-fit text-ink" aria-label="Horaya, accueil">
          <HorayaWordmark height={18} />
        </Link>
        <header className="flex flex-col gap-3 px-1 pt-4">
          <h1 className="text-[40px] font-medium leading-[44px] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="text-base leading-7 text-ink-muted">{intro}</p>
        </header>
        {children}
        <nav
          aria-label="Pages légales"
          className="flex flex-wrap gap-x-5 gap-y-2 px-1 pt-2 text-sm text-ink-muted"
        >
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-6">
      <h2 className="text-xl font-semibold leading-6 text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-base leading-7 text-ink-muted">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ink-subtle">
      {items.map((item, index) => (
        // Liste figée : l'ordre ne change jamais.
        // biome-ignore lint/suspicious/noArrayIndexKey: contenu statique
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="font-semibold text-ink underline underline-offset-[3px]">
      {children}
    </a>
  );
}

export function Mail() {
  return <TextLink href={`mailto:${CONTACT}`}>{CONTACT}</TextLink>;
}
