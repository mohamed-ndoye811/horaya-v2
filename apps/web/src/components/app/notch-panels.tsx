"use client";

import { type ComponentType, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  ArrowRight,
  BellIcon,
  BoxIcon,
  CalendarIcon,
  DashboardIcon,
  EnterIcon,
  ExternalIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/ui/icons";
import {
  type NotificationItem,
  openNotifications,
  readNotifications,
  type SearchHit,
  type SearchResults,
  searchWorkspace,
} from "@/functions/notch";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { Link, useRouter } from "@/lib/navigation";

/*
 * Panneaux du notch (recherche, notifications, compte), partagés avec le grand menu mobile
 * (mobile-menu.tsx). Sur fond noir ; le notch les pose dans son panneau, le menu dans sa feuille.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
}

export interface NavLink {
  href: string;
  label: string;
  /** Sous le titre de sa carte, dans le menu du notch. */
  detail: string;
  /** Libellé de la puce dans le menu mobile ; sans lui, le lien n'y figure pas. */
  chip?: string;
  /** Lien vers les réservations à valider : il porte leur nombre. */
  pending?: boolean;
}

export interface NavSection extends NavItem {
  /** Menu de la section : la languette du notch au survol, les puces du menu mobile. */
  links: NavLink[];
  create?: NavLink;
}

/** L'accueil : le logo du notch, une ligne du menu mobile. */
export const HOME: NavSection = { href: "/app", label: "Accueil", icon: DashboardIcon, links: [] };

/** Les sections du notch ; les réglages sont dans le compte (l'avatar). */
export const NAV: NavSection[] = [
  {
    href: "/app/calendrier",
    label: "Calendrier",
    icon: CalendarIcon,
    links: [
      { href: "/app/calendrier?vue=mois", label: "Mois", detail: "Le mois d'un coup d'œil" },
      {
        href: "/app/calendrier?vue=semaine",
        label: "Semaine",
        detail: "Tes créneaux, heure par heure",
      },
      { href: "/app/calendrier?vue=jour", label: "Jour", detail: "Le programme de la journée" },
      {
        href: "/app/evenements/liens",
        label: "Liens calendrier",
        detail: "Google, Apple, Outlook",
        chip: "Liens",
      },
    ],
  },
  {
    href: "/app/evenements",
    label: "Événements",
    icon: TicketIcon,
    links: [
      {
        href: "/app/evenements",
        label: "Tous les événements",
        detail: "À venir, brouillons, passés",
      },
      { href: "/app/evenements?onglet=draft", label: "Brouillons", detail: "Pas encore publiés" },
      {
        href: "/app/evenements/types",
        label: "Types d'événements",
        detail: "Modèles, questions, règles",
        chip: "Types",
      },
      {
        href: "/app/cartes",
        label: "Cartes de séances",
        detail: "Formules à plusieurs séances",
        chip: "Cartes",
      },
    ],
    create: {
      href: "/app/evenements/nouveau",
      label: "Nouvel événement",
      detail: "Une séance, un stage, un atelier",
    },
  },
  {
    href: "/app/reservations",
    label: "Réservations",
    icon: ReceiptIcon,
    links: [
      { href: "/app/reservations", label: "Toutes", detail: "Confirmées, en attente, annulées" },
      {
        href: "/app/reservations?statut=pending",
        label: "À valider",
        detail: "Les demandes à accepter",
        pending: true,
      },
    ],
    create: {
      href: "/app/reservations/nouvelle",
      label: "Nouvelle réservation",
      detail: "Au comptoir ou par téléphone",
    },
  },
  {
    href: "/app/materiel",
    label: "Matériel",
    icon: BoxIcon,
    links: [
      { href: "/app/materiel", label: "Tous les articles", detail: "Stock, prix, disponibilité" },
      {
        href: "/app/materiel?filtre=maintenance",
        label: "En maintenance",
        detail: "Les articles indisponibles",
      },
    ],
    create: {
      href: "/app/materiel/nouveau",
      label: "Nouvel article",
      detail: "Du matériel à louer",
    },
  },
  {
    href: "/app/clients",
    label: "Clients",
    icon: UsersIcon,
    links: [
      { href: "/app/clients", label: "Tous les clients", detail: "Fiches, historique, notes" },
      {
        href: "/app/bons-cadeaux",
        label: "Bons cadeaux",
        detail: "Vendus, utilisés, en cours",
        chip: "Bons cadeaux",
      },
    ],
    create: { href: "/app/clients/nouveau", label: "Nouveau client", detail: "Une nouvelle fiche" },
  },
];

/** Menu du bouton « Créer » : la réservation au comptoir d'abord. */
export const CREATE_LINKS: NavLink[] = [
  {
    href: "/app/reservations/nouvelle",
    label: "Réservation",
    detail: "Au comptoir ou par téléphone",
  },
  {
    href: "/app/evenements/nouveau",
    label: "Événement",
    detail: "Une séance, un stage, un atelier",
  },
  { href: "/app/clients/nouveau", label: "Client", detail: "Une nouvelle fiche" },
  { href: "/app/bons-cadeaux/nouveau", label: "Bon cadeau", detail: "À offrir ou à vendre" },
  { href: "/app/materiel/nouveau", label: "Article", detail: "Du matériel à louer" },
];

export function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Section de la page ouverte : la correspondance la plus précise parmi les sections et les pages
 * de leurs menus (« Liens calendrier » est sous /app/evenements mais range au Calendrier).
 */
export function activeSection(pathname: string): string | undefined {
  let best: { section: string; length: number } | undefined;
  for (const section of NAV) {
    for (const href of [section.href, ...section.links.map((link) => link.href.split("?")[0])]) {
      if (href && isActive(pathname, href) && href.length > (best?.length ?? 0))
        best = { section: section.href, length: href.length };
    }
  }
  return best?.section;
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 text-[13px] font-semibold leading-4 text-on-ink-subtle">
      {children}
    </div>
  );
}

/** Pastille orange du compte (initiales ou photo). */
export function AccountAvatar({ user, className }: { user: AccountUser; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-gradient font-bold text-on-ink",
        className,
      )}
    >
      {user.image ? (
        <img src={user.image} alt="" className="size-full rounded-full object-cover" />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}

/** Met en gras la partie qui correspond à la recherche. */
function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span className="font-bold text-on-ink">{text.slice(index, index + query.length)}</span>
      {text.slice(index + query.length)}
    </>
  );
}

interface Choice {
  key: string;
  href: string;
  group: string;
  hit?: SearchHit;
  kind: "event" | "item" | "customer" | "booking" | "page" | "action";
  label: ReactNode;
}

const NO_RESULTS: SearchResults = { events: [], items: [], customers: [], bookings: [] };

const CREATE_GROUP = "Créer";

/**
 * Recherche dans l'espace et créations rapides. `sheet` (grand menu mobile) : ni raccourcis
 * clavier, ni suggestions avant de taper, pas de focus d'office (le clavier du téléphone
 * cacherait le menu) ; `idle` s'affiche sous « Créer » tant qu'on ne cherche pas.
 */
export function SearchPanel({
  onClose,
  wide,
  sheet = false,
  focus = !sheet,
  idle,
}: {
  onClose: () => void;
  wide: boolean;
  sheet?: boolean;
  /** Le champ prend le curseur à l'ouverture. */
  focus?: boolean;
  idle?: ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(NO_RESULTS);
  const [loading, setLoading] = useState(false);
  // Sur téléphone, rien n'est présélectionné avant la première recherche.
  const [active, setActive] = useState(sheet ? -1 : 0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const trimmed = query.trim();

  const searching = trimmed.length >= 2;

  // Sans recherche : raccourcis (à valider, prochains événements), chargés aussitôt.
  const request = searching ? trimmed : "";
  const skip = sheet && !searching;
  useEffect(() => {
    if (skip) {
      setResults(NO_RESULTS);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = setTimeout(
      async () => {
        const found = await searchWorkspace(request);
        if (stale) return;
        setResults(found);
        setLoading(false);
        setActive(0);
      },
      request ? 150 : 0,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [request, skip]);

  const choices: Choice[] = [
    // Les pages d'abord : elles s'affichent aussitôt, sans attendre le serveur.
    ...(searching
      ? PAGES.filter((page) => fold(page.label).includes(fold(trimmed)))
          .slice(0, 4)
          .map((page) => ({
            key: `page-${page.href}`,
            href: page.href,
            group: "Pages",
            kind: "page" as const,
            label: <Highlight text={page.label} query={trimmed} />,
          }))
      : []),
    ...(searching
      ? []
      : results.bookings.map((hit) => ({
          key: hit.href,
          href: hit.href,
          group: "À valider",
          hit,
          kind: "booking" as const,
          label: hit.title,
        }))),
    ...results.events.map((hit) => ({
      key: hit.href,
      href: hit.href,
      group: searching ? "Événements" : "Prochains événements",
      hit,
      kind: "event" as const,
      label: <Highlight text={hit.title} query={trimmed} />,
    })),
    ...results.items.map((hit) => ({
      key: hit.href,
      href: hit.href,
      group: "Matériel",
      hit,
      kind: "item" as const,
      label: <Highlight text={hit.title} query={trimmed} />,
    })),
    ...results.customers.map((hit) => ({
      key: hit.href,
      href: hit.href,
      group: "Clients",
      hit,
      kind: "customer" as const,
      label: <Highlight text={hit.title} query={trimmed} />,
    })),
    ...(searching
      ? results.bookings.map((hit) => ({
          key: hit.href,
          href: hit.href,
          group: "Réservations",
          hit,
          kind: "booking" as const,
          label: <Highlight text={hit.title} query={trimmed} />,
        }))
      : []),
    searching
      ? {
          key: "new-event",
          href: `/app/evenements/nouveau?titre=${encodeURIComponent(trimmed)}`,
          group: CREATE_GROUP,
          kind: "action" as const,
          label: (
            <>
              Événement « <span className="font-bold text-on-ink">{trimmed}</span> »
            </>
          ),
        }
      : {
          key: "new-event",
          href: "/app/evenements/nouveau",
          group: CREATE_GROUP,
          kind: "action" as const,
          label: "Nouvel événement",
        },
    {
      key: "new-booking",
      href: "/app/reservations/nouvelle",
      group: CREATE_GROUP,
      kind: "action" as const,
      label: "Nouvelle réservation",
    },
    {
      key: "new-customer",
      href: "/app/clients/nouveau",
      group: CREATE_GROUP,
      kind: "action" as const,
      label: "Nouveau client",
    },
  ];

  function go(choice: Choice | undefined) {
    if (!choice) return;
    onClose();
    router.push(choice.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        (Math.max(active, 0) + (event.key === "ArrowDown" ? 1 : -1) + choices.length) %
        choices.length;
      setActive(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(choices[active]);
    }
  }

  const groups = [...new Set(choices.map((choice) => choice.group))];
  const mainGroups = groups.filter((group) => group !== CREATE_GROUP);
  const nothing = !loading && !skip && mainGroups.length === 0;

  const renderGroup = (group: string) => (
    <div key={group} className="flex flex-col gap-1">
      <GroupLabel>{group}</GroupLabel>
      {choices.map((choice, index) =>
        choice.group === group ? (
          <SearchRow
            key={choice.key}
            id={`${listId}-${index}`}
            choice={choice}
            index={index}
            active={index === active}
            onHover={() => setActive(index)}
            onPick={() => go(choice)}
          />
        ) : null,
      )}
    </div>
  );

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-3 rounded-2xl bg-white/8 pr-2 pl-4 text-on-ink">
        <SearchIcon size={18} />
        <input
          // biome-ignore lint/a11y/noAutofocus: la recherche s'ouvre pour qu'on y tape aussitôt
          autoFocus={focus}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Un événement, un client, une référence…"
          aria-label="Rechercher"
          aria-controls={listId}
          aria-activedescendant={choices[active] ? `${listId}-${active}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold leading-5 text-on-ink caret-accent outline-none placeholder:font-medium placeholder:text-on-ink-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {!sheet && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-[26px] items-center rounded-lg border border-white/15 px-2 text-[13px] font-semibold leading-4 text-notch-idle hover:text-on-ink"
          >
            Échap
          </button>
        )}
      </div>
      <div
        id={listId}
        role="listbox"
        ref={listRef}
        className={wide ? "grid grid-cols-[minmax(0,1fr)_280px] gap-6" : "flex flex-col gap-3.5"}
      >
        {/* Résultats (ou raccourcis) à gauche. */}
        {!skip && (
          <div className="flex min-w-0 flex-col gap-3.5">
            {nothing && (
              <p className="px-2 py-3 text-[15px] leading-[19px] text-on-ink-soft">
                {searching
                  ? `Rien ne correspond à « ${trimmed} ».`
                  : "Rien à valider, aucun événement à venir."}
              </p>
            )}
            {mainGroups.map(renderGroup)}
          </div>
        )}
        {/* Créer et raccourcis clavier à droite. */}
        <div className={cn("flex flex-col gap-3.5", wide && "border-l border-white/8 pl-6")}>
          {/* Menu mobile sans recherche : les créations sont des puces, sous la recherche. */}
          {!(sheet && !searching) && renderGroup(CREATE_GROUP)}
          {!sheet && (
            <div
              className={cn(
                "flex px-2 text-[13px] leading-4 text-on-ink-subtle",
                wide
                  ? "mt-auto flex-col gap-2.5 pt-3"
                  : "flex-wrap gap-4 border-t border-white/8 pt-3",
              )}
            >
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> pour choisir
              </span>
              <span>
                <Kbd>Entrée</Kbd> pour ouvrir
              </span>
              <span>
                <Kbd>⌘</Kbd> <Kbd>K</Kbd> pour rouvrir d'où tu veux
              </span>
            </div>
          )}
        </div>
      </div>
      {!searching && idle}
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/15 px-1 font-sans text-xs font-semibold text-notch-idle">
      {children}
    </kbd>
  );
}

function SearchRow({
  id,
  choice,
  index,
  active,
  onHover,
  onPick,
}: {
  id: string;
  choice: Choice;
  index: number;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const { hit, kind } = choice;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: le clavier passe par le champ (flèches, Entrée)
    <div
      id={id}
      data-index={index}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseMove={onHover}
      onClick={onPick}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-3 rounded-[14px] px-2",
        kind === "action" || kind === "page" ? "h-11" : kind === "customer" ? "h-[52px]" : "h-14",
        active && "bg-white/8",
      )}
    >
      {kind === "customer" && hit ? (
        <Avatar name={hit.title} size="lg" />
      ) : kind === "page" ? (
        <span className="flex h-8 w-10 shrink-0 items-center justify-center text-notch-idle">
          <ArrowRight className="size-3.5" />
        </span>
      ) : kind === "action" ? (
        <span className="flex h-8 w-10 shrink-0 items-center justify-center text-accent">
          <PlusIcon size={18} />
        </span>
      ) : hit?.image ? (
        <span
          aria-hidden="true"
          className="size-10 shrink-0 rounded-[10px] bg-cover bg-center"
          style={{ backgroundImage: `url(${hit.image})` }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/8"
          style={{ color: hit?.color ?? "var(--color-notch-idle)" }}
        >
          {kind === "booking" ? (
            <ReceiptIcon size={18} />
          ) : kind === "item" ? (
            <BoxIcon size={18} />
          ) : (
            <TicketIcon size={18} />
          )}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold leading-[19px] text-on-ink-soft">
          {choice.label}
        </span>
        {hit && (
          <span className="truncate text-[13px] leading-4 text-on-ink-subtle">{hit.detail}</span>
        )}
      </span>
      {active && (
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/12 text-on-ink"
        >
          <EnterIcon size={14} />
        </span>
      )}
    </div>
  );
}

/** Dernières notifications ; une seconde à l'écran les passe en lu (`onLoaded`). */
const SEEN_AFTER = 1000;

export function NotificationsPanel({
  onClose,
  onLoaded,
  wide,
}: {
  onClose: () => void;
  onLoaded: () => void;
  wide: boolean;
}) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  // Elles passent en lu après une seconde à l'écran : un simple survol de la cloche n'y touche pas.
  useEffect(() => {
    let stale = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    openNotifications().then((loaded) => {
      if (stale) return;
      setItems(loaded);
      if (!loaded.some((item) => item.unread)) return;
      timer = setTimeout(() => readNotifications().then(onLoaded), SEEN_AFTER);
    });
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [onLoaded]);

  const list = <NotificationList items={items} onClose={onClose} />;
  return (
    <div className={wide ? "grid grid-cols-[minmax(0,1fr)_280px] gap-6" : "flex flex-col gap-3.5"}>
      <div className="flex min-w-0 flex-col gap-1">
        {!wide && <GroupLabel>Notifications</GroupLabel>}
        {list}
      </div>
      <div
        className={cn(
          "flex flex-col gap-3 px-2",
          wide ? "border-l border-white/8 py-2 pl-6" : "border-t border-white/8 pt-3",
        )}
      >
        {wide && (
          <span className="text-base font-semibold leading-5 text-on-ink">Notifications</span>
        )}
        <p className="text-[13px] leading-[18px] text-on-ink-subtle">
          Nouvelles réservations, annulations par tes clients et paiements arrivent ici. Tu choisis
          ce qui te prévient, dans l'app ou par e-mail.
        </p>
        <Link
          href="/app/parametres/notifications"
          onClick={onClose}
          className="text-[13px] font-semibold leading-4 text-on-ink hover:text-notch-idle"
        >
          Régler mes notifications →
        </Link>
      </div>
    </div>
  );
}

function NotificationList({
  items,
  onClose,
}: {
  items: NotificationItem[] | null;
  onClose: () => void;
}) {
  return (
    <>
      {items === null ? (
        <p className="px-2 py-3 text-[15px] leading-[19px] text-on-ink-subtle">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="px-2 py-3 text-[15px] leading-[19px] text-on-ink-soft">Rien de neuf.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className="relative flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/8 text-notch-idle"
                >
                  <BellIcon size={18} />
                  {item.unread && (
                    <span className="absolute -top-0.5 -right-0.5 size-[9px] rounded-full border-2 border-ink bg-accent" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "truncate text-[15px] font-semibold leading-[19px]",
                      item.unread ? "text-on-ink" : "text-on-ink-soft",
                    )}
                  >
                    {item.title}
                  </span>
                  {item.body && (
                    <span className="truncate text-[13px] leading-4 text-on-ink-subtle">
                      {item.body}
                    </span>
                  )}
                </span>
                <span className="shrink-0 self-start pt-0.5 text-[13px] leading-4 text-on-ink-subtle">
                  {item.when}
                </span>
              </>
            );
            const row = "flex items-center gap-3 rounded-[14px] px-2 py-2";
            return (
              <li key={item.id}>
                {item.link ? (
                  <Link href={item.link} onClick={onClose} className={cn(row, "hover:bg-white/8")}>
                    {content}
                  </Link>
                ) : (
                  <div className={row}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Carte d'un panneau du notch : titre et ligne de détail (réglages, menus des sections). */
const CARD =
  "flex flex-col gap-1 rounded-[14px] bg-white/6 px-3.5 py-3 transition-colors hover:bg-white/12";

/**
 * Menu d'une section (ou du bouton Créer), ouvert au survol de son icône : ses pages en cartes,
 * comme les réglages du compte ; la création de la section en premier.
 */
export function SectionPanel({
  menu,
  pending,
  onClose,
  wide,
}: {
  /** Adresse de la section, ou « create ». */
  menu: string;
  /** Réservations à valider, sur la carte « À valider ». */
  pending: number;
  onClose: () => void;
  wide: boolean;
}) {
  const section = NAV.find((item) => item.href === menu);
  const cards = section
    ? [
        ...(section.create ? [{ ...section.create, create: true }] : []),
        ...section.links.map((link) => ({ ...link, create: false })),
      ]
    : CREATE_LINKS.map((link) => ({ ...link, create: true }));
  return (
    <div className="flex flex-col gap-3">
      <h2 className="px-2 pt-1 font-headline text-2xl leading-7 text-on-ink">
        {section?.label ?? "Créer"}
      </h2>
      <div className={cn("grid gap-2", wide ? "grid-cols-3" : "grid-cols-2")}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} onClick={onClose} className={CARD}>
            <span className="flex items-center gap-1.5 text-[15px] font-semibold leading-[19px] text-on-ink">
              {card.create && <PlusIcon size={14} className="shrink-0 text-accent" />}
              <span className="truncate">{card.label}</span>
              {card.pending && pending > 0 && (
                <span className="flex h-5 shrink-0 items-center rounded-full bg-accent px-2 text-xs font-bold leading-4 text-ink">
                  {pending}
                </span>
              )}
            </span>
            <span className="truncate text-[13px] leading-4 text-on-ink-subtle">{card.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const COCKPIT_LINK = {
  href: "/app/plateforme",
  label: "Cockpit",
  detail: "Espaces, comptes, licences",
};

const ACCOUNT_LINKS = [
  { href: "/app/parametres/profil", label: "Mon profil", detail: "Ton nom, ton mot de passe" },
  {
    href: "/app/parametres/organisation",
    label: "Organisation",
    detail: "Identité, marque, mentions légales",
  },
  { href: "/app/parametres/membres", label: "Membres", detail: "Ton équipe et les invitations" },
  { href: "/app/parametres/paiements", label: "Paiements", detail: "Encaissement, acompte, TVA" },
  {
    href: "/app/parametres/abonnement",
    label: "Abonnement",
    detail: "Ta formule Horaya, tes factures",
  },
  {
    href: "/app/parametres/notifications",
    label: "Notifications",
    detail: "Ce qui te prévient, et comment",
  },
  {
    href: "/app/parametres/integrations",
    label: "Intégrations",
    detail: "Tes autres outils · bientôt",
  },
];

/** Pages que la recherche trouve par leur nom (« types », « abonnement »). */
const PAGES = [
  HOME,
  ...NAV.flatMap((section) => [
    section,
    ...section.links.filter((link) => !link.href.includes("?") && link.href !== section.href),
  ]),
  ...ACCOUNT_LINKS.map((link) => ({ href: link.href, label: `Réglages · ${link.label}` })),
];

/** Minuscules sans accents : « evenement » trouve « Événements ». */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export interface AccountUser {
  name: string;
  image: string | null;
  /** Équipe Horaya : accès au cockpit de la plateforme. */
  platformAdmin?: boolean;
}

/** Le compte : paramètres, qui est connecté, et la sortie. */
export function AccountPanel({
  user,
  workspace,
  onClose,
  wide,
  compact = false,
}: {
  user: AccountUser;
  workspace: { name: string; slug: string };
  onClose: () => void;
  wide: boolean;
  /** Menu mobile : pas de grille des réglages, un lien vers leur page ; la page publique est plus haut. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  const row =
    "flex h-11 w-full items-center rounded-[14px] px-2 text-left text-[15px] font-semibold leading-[19px] transition-colors hover:bg-white/8";
  return (
    <div className={wide ? "grid grid-cols-[minmax(0,1fr)_280px] gap-6" : "flex flex-col gap-3.5"}>
      {!compact && (
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="px-2 pt-1 pb-2 font-headline text-2xl leading-7 text-on-ink">
            Paramètres
          </h2>
          <div className={cn("grid gap-2", wide ? "grid-cols-3" : "grid-cols-2")}>
            {(user.platformAdmin ? [...ACCOUNT_LINKS, COCKPIT_LINK] : ACCOUNT_LINKS).map((link) => (
              <Link key={link.href} href={link.href} onClick={onClose} className={CARD}>
                <span className="truncate text-[15px] font-semibold leading-[19px] text-on-ink">
                  {link.label}
                </span>
                <span className="truncate text-[13px] leading-4 text-on-ink-subtle">
                  {link.detail}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {/* Qui est connecté, et la sortie. */}
      <div
        className={cn(
          "flex flex-col gap-3",
          wide ? "border-l border-white/8 pt-2 pl-6" : !compact && "border-t border-white/8 pt-3",
        )}
      >
        <div className="flex items-center gap-3 px-2">
          <AccountAvatar user={user} className="size-10 text-sm" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-base font-semibold leading-5 text-on-ink">
              {user.name}
            </span>
            <span className="truncate text-[13px] leading-4 text-on-ink-subtle">
              {workspace.name}
            </span>
          </span>
          {compact && (
            <Link
              href="/app/plus"
              onClick={onClose}
              className="ml-auto flex h-9 shrink-0 items-center rounded-full bg-white/8 px-3.5 text-[13px] font-semibold leading-4 text-on-ink transition-colors hover:bg-white/12"
            >
              Réglages
            </Link>
          )}
        </div>
        {!compact && (
          <a
            href={`/${workspace.slug}`}
            target="_blank"
            rel="noopener"
            onClick={onClose}
            className={cn(row, "gap-2 text-on-ink", wide && "mt-auto")}
          >
            Ma page publique
            <ExternalIcon size={14} className="text-notch-idle" />
          </a>
        )}
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          className={cn(row, "text-danger-on-ink")}
        >
          {pending ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );
}
