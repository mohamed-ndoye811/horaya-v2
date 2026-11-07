"use client";

import { type ComponentType, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  BellIcon,
  BoxIcon,
  CalendarIcon,
  DashboardIcon,
  EnterIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/ui/icons";
import {
  type NotificationItem,
  openNotifications,
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

export const NAV: NavItem[] = [
  { href: "/app", label: "Accueil", icon: DashboardIcon },
  { href: "/app/calendrier", label: "Calendrier", icon: CalendarIcon },
  { href: "/app/evenements", label: "Événements", icon: TicketIcon },
  { href: "/app/reservations", label: "Réservations", icon: ReceiptIcon },
  { href: "/app/materiel", label: "Matériel", icon: BoxIcon },
  { href: "/app/clients", label: "Clients", icon: UsersIcon },
  { href: "/app/parametres", label: "Réglages", icon: SettingsIcon },
];

export function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
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
  kind: "event" | "item" | "customer" | "booking" | "action";
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
  idle,
}: {
  onClose: () => void;
  wide: boolean;
  sheet?: boolean;
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
          autoFocus={!sheet}
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
          {renderGroup(CREATE_GROUP)}
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
        kind === "action" ? "h-11" : kind === "customer" ? "h-[52px]" : "h-14",
        active && "bg-white/8",
      )}
    >
      {kind === "customer" && hit ? (
        <Avatar name={hit.title} size="lg" />
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

/** Dernières notifications ; les charger les passe en lu (`onLoaded`). */
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

  useEffect(() => {
    let stale = false;
    openNotifications().then((loaded) => {
      if (stale) return;
      setItems(loaded);
      onLoaded();
    });
    return () => {
      stale = true;
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

export interface AccountUser {
  name: string;
  image: string | null;
}

/** Le compte : paramètres, qui est connecté, et la sortie. */
export function AccountPanel({
  user,
  workspace,
  onClose,
  wide,
}: {
  user: AccountUser;
  workspace: { name: string };
  onClose: () => void;
  wide: boolean;
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
      <div className="flex min-w-0 flex-col gap-1">
        <GroupLabel>Paramètres</GroupLabel>
        <div className={cn("grid gap-2", wide ? "grid-cols-3" : "grid-cols-2")}>
          {ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="flex flex-col gap-1 rounded-[14px] bg-white/6 px-3.5 py-3 transition-colors hover:bg-white/12"
            >
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
      {/* Qui est connecté, et la sortie. */}
      <div
        className={cn(
          "flex flex-col gap-3",
          wide ? "border-l border-white/8 pt-2 pl-6" : "border-t border-white/8 pt-3",
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
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          className={cn(row, "text-danger-on-ink", wide && "mt-auto")}
        >
          {pending ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );
}
