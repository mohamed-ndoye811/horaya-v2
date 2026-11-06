"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type NotificationItem,
  openNotifications,
  type SearchHit,
  type SearchResults,
  searchWorkspace,
} from "@/app/app/notch-actions";
import { ActiveIndicator } from "@/components/motion/indicator";
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
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { HorayaMark } from "./logo";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Accueil", icon: DashboardIcon },
  { href: "/app/calendrier", label: "Calendrier", icon: CalendarIcon },
  { href: "/app/evenements", label: "Événements", icon: TicketIcon },
  { href: "/app/reservations", label: "Réservations", icon: ReceiptIcon },
  { href: "/app/materiel", label: "Matériel", icon: BoxIcon },
  { href: "/app/clients", label: "Clients", icon: UsersIcon },
  { href: "/app/parametres", label: "Réglages", icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/* Courbes du notch (Paper « 0.1 · Notch · états ») : 44 px de chaque côté, le milieu s'étire. */
const EAR_LEFT = "M0 0 L0 6 C24 6 20 56 44 56 L45 56 L45 0 Z";
const EAR_RIGHT = "M45 0 L45 6 C21 6 25 56 1 56 L0 56 L0 0 Z";
/* Panneau déroulé : 28 px de courbe de chaque côté, sur 36 px de haut. */
const PANEL_EAR_LEFT = "M0 0 L0 6 C22 6 28 14 28 36 L29 36 L29 0 Z";
const PANEL_EAR_RIGHT = "M29 0 L29 6 C7 6 1 14 1 36 L0 36 L0 0 Z";

/** Libellés au survol seulement si le notch déplié tient dans l'écran. */
const EXPAND_MIN_WIDTH = 1280;
/** Survol bref (souris qui traverse vers un bouton d'en-tête) : on ne déplie pas. */
const EXPAND_DELAY = 250;
/** Repli après 1 s hors du notch (maquette). */
const COLLAPSE_DELAY = 1000;

type Panel = "search" | "notifications" | null;

export interface NotchProps {
  user: { name: string; shortName: string };
  workspace: { name: string };
  /** Réservations à valider : pastille orange sur l'icône. */
  pendingBookings: number;
  /** Notifications non lues : pastille sur la cloche. */
  unreadNotifications: number;
}

/** Navigation de l'admin sur grand écran : le notch noir en haut, au centre (DA v4). */
export function Notch({ user, workspace, pendingBookings, unreadNotifications }: NotchProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [unread, setUnread] = useState(unreadNotifications);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setUnread(unreadNotifications), [unreadNotifications]);

  // ⌘K / Ctrl K ouvre ou ferme la recherche, où que l'on soit.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanel((current) => (current === "search" ? null : "search"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Changement de page : on replie tout.
  // biome-ignore lint/correctness/useExhaustiveDependencies: déclenché par la navigation
  useEffect(() => {
    setPanel(null);
    setExpanded(false);
  }, [pathname]);

  function expand(delay: number) {
    clearTimeout(timer.current);
    if (window.innerWidth < EXPAND_MIN_WIDTH) return;
    timer.current = setTimeout(() => setExpanded(true), delay);
  }
  function scheduleCollapse() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setExpanded(false), expanded ? COLLAPSE_DELAY : 0);
  }
  const close = useCallback(() => setPanel(null), []);
  const markRead = useCallback(() => setUnread(0), []);

  return (
    <>
      {/* Fondu sous le notch : le contenu s'efface avant de passer dessous (comme sur mobile). */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-1.5 top-1.5 z-40 hidden h-[72px] rounded-t-[10px] bg-linear-to-t from-bg/0 via-bg via-50% to-bg lg:block"
      />
      {panel && (
        <button
          type="button"
          aria-label="Fermer"
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-40 hidden animate-fade cursor-default bg-ink/22 backdrop-blur-[3px] lg:block"
        />
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: survol et focus déplient les libellés, sans action */}
      <div
        data-tour="notch"
        className="fixed top-0 left-1/2 z-50 hidden -translate-x-1/2 lg:block"
        onMouseEnter={() => expand(EXPAND_DELAY)}
        onMouseLeave={scheduleCollapse}
        onFocus={() => expand(0)}
        onBlur={scheduleCollapse}
      >
        <div
          className={cn(
            "relative flex h-14 items-start bg-ink transition-opacity duration-150",
            panel && "pointer-events-none opacity-0",
          )}
        >
          <svg
            width="45"
            height="56"
            viewBox="0 0 45 56"
            aria-hidden="true"
            className="absolute top-0 right-[calc(100%-1px)]"
          >
            <path d={EAR_LEFT} className="fill-ink" />
          </svg>
          <svg
            width="45"
            height="56"
            viewBox="0 0 45 56"
            aria-hidden="true"
            className="absolute top-0 left-[calc(100%-1px)]"
          >
            <path d={EAR_RIGHT} className="fill-ink" />
          </svg>
          <div className="relative top-[3px] flex h-[50px] items-center gap-1.5">
            <Link
              href="/app"
              aria-label="Horaya, tableau de bord"
              className="flex size-9 items-center justify-center text-on-ink"
            >
              <HorayaMark size={18} />
            </Link>
            <Separator />
            <nav aria-label="Navigation principale" className="flex items-center gap-1.5">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                const pending = item.href === "/app/reservations" && pendingBookings > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={
                      pending ? `${item.label}, ${pendingBookings} à valider` : item.label
                    }
                    title={expanded ? undefined : item.label}
                    className={cn(
                      "relative isolate flex h-10 items-center rounded-xl px-2.5 transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
                      active ? "text-on-ink" : "text-notch-idle hover:text-on-ink",
                    )}
                  >
                    {active && (
                      <ActiveIndicator
                        id="notch"
                        className="inset-0 -z-10 rounded-xl bg-on-ink/16"
                      />
                    )}
                    <Icon size={20} />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "overflow-hidden whitespace-nowrap text-sm font-semibold leading-[18px] transition-[max-width,opacity,margin,padding] duration-300 ease-out",
                        expanded ? "ml-2 max-w-28 pr-1 opacity-100" : "max-w-0 opacity-0",
                      )}
                    >
                      {item.label}
                    </span>
                    {pending && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 left-[25px] size-[7px] rounded-full bg-accent"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
            <Separator />
            <NotchButton
              label="Rechercher (⌘K)"
              onClick={() => setPanel("search")}
              expanded={panel === "search"}
            >
              <SearchIcon size={20} />
            </NotchButton>
            <NotchButton
              label={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
              onClick={() => setPanel("notifications")}
              expanded={panel === "notifications"}
            >
              <BellIcon size={20} />
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-[9px] right-[10px] size-[9px] rounded-full border-2 border-ink bg-accent"
                />
              )}
            </NotchButton>
            <AccountMenu user={user} workspace={workspace} />
          </div>
        </div>
        {panel === "search" && <SearchPanel onClose={close} />}
        {panel === "notifications" && <NotificationsPanel onClose={close} onLoaded={markRead} />}
      </div>
    </>
  );
}

function Separator() {
  return <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-white/22" />;
}

function NotchButton({
  label,
  onClick,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-xl text-notch-idle transition-colors hover:text-on-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
    >
      {children}
    </button>
  );
}

/** Le notch qui descend en panneau (recherche, notifications) : mêmes courbes, coins bas arrondis. */
function NotchPanel({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={label}
      className="absolute top-0 left-1/2 w-[680px] -translate-x-1/2 animate-notch-open px-7"
    >
      <svg
        width="29"
        height="36"
        viewBox="0 0 29 36"
        aria-hidden="true"
        className="absolute top-0 left-0"
      >
        <path d={PANEL_EAR_LEFT} className="fill-ink" />
      </svg>
      <svg
        width="29"
        height="36"
        viewBox="0 0 29 36"
        aria-hidden="true"
        className="absolute top-0 right-0"
      >
        <path d={PANEL_EAR_RIGHT} className="fill-ink" />
      </svg>
      <div className="relative flex max-h-[calc(100dvh-80px)] flex-col gap-3.5 overflow-y-auto rounded-b-[28px] bg-ink px-4 pt-2.5 pb-4">
        {children}
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 text-[13px] font-semibold leading-4 text-[#6e727c]">{children}</div>
  );
}

/** Met en gras la partie qui correspond à la recherche. */
function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span className="font-bold text-white">{text.slice(index, index + query.length)}</span>
      {text.slice(index + query.length)}
    </>
  );
}

interface Choice {
  key: string;
  href: string;
  group: string;
  hit?: SearchHit;
  kind: "event" | "customer" | "booking" | "action";
  label: ReactNode;
}

const NO_RESULTS: SearchResults = { events: [], customers: [], bookings: [] };

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(NO_RESULTS);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults(NO_RESULTS);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const found = await searchWorkspace(trimmed);
      if (stale) return;
      setResults(found);
      setLoading(false);
      setActive(0);
    }, 150);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const choices: Choice[] = [
    ...results.events.map((hit) => ({
      key: hit.href,
      href: hit.href,
      group: "Événements",
      hit,
      kind: "event" as const,
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
    ...results.bookings.map((hit) => ({
      key: hit.href,
      href: hit.href,
      group: "Réservations",
      hit,
      kind: "booking" as const,
      label: <Highlight text={hit.title} query={trimmed} />,
    })),
    ...(trimmed.length >= 2
      ? [
          {
            key: "create-event",
            href: `/app/evenements/nouveau?titre=${encodeURIComponent(trimmed)}`,
            group: "Actions",
            kind: "action" as const,
            label: (
              <>
                Créer l'événement « <span className="font-bold text-white">{trimmed}</span> »
              </>
            ),
          },
        ]
      : [
          {
            key: "new-booking",
            href: "/app/reservations/nouvelle",
            group: "Actions",
            kind: "action" as const,
            label: "Nouvelle réservation",
          },
          {
            key: "new-event",
            href: "/app/evenements/nouveau",
            group: "Actions",
            kind: "action" as const,
            label: "Nouvel événement",
          },
          {
            key: "new-customer",
            href: "/app/clients/nouveau",
            group: "Actions",
            kind: "action" as const,
            label: "Nouveau client",
          },
        ]),
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
        (active + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
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
  const empty = trimmed.length >= 2 && !loading && choices.length === 1;

  return (
    <NotchPanel label="Recherche" onClose={onClose}>
      <div className="flex h-12 shrink-0 items-center gap-3 rounded-2xl bg-white/8 pr-2 pl-4 text-white">
        <SearchIcon size={18} />
        <input
          // biome-ignore lint/a11y/noAutofocus: la recherche s'ouvre pour qu'on y tape aussitôt
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Un événement, un client, une référence…"
          aria-label="Rechercher"
          aria-controls="notch-search-results"
          aria-activedescendant={choices[active] ? `notch-choice-${active}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold leading-5 text-white caret-accent outline-none placeholder:font-medium placeholder:text-[#6e727c] [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={onClose}
          className="flex h-[26px] items-center rounded-lg border border-white/15 px-2 text-[13px] font-semibold leading-4 text-notch-idle hover:text-on-ink"
        >
          Échap
        </button>
      </div>
      <div id="notch-search-results" role="listbox" ref={listRef} className="flex flex-col gap-3.5">
        {empty && (
          <p className="px-2 text-[15px] leading-[19px] text-[#c9cbd1]">
            Rien ne correspond à « {trimmed} ».
          </p>
        )}
        {groups.map((group) => (
          <div key={group} className="flex flex-col gap-1">
            <GroupLabel>{group}</GroupLabel>
            {choices.map((choice, index) =>
              choice.group === group ? (
                <SearchRow
                  key={choice.key}
                  choice={choice}
                  index={index}
                  active={index === active}
                  onHover={() => setActive(index)}
                  onPick={() => go(choice)}
                />
              ) : null,
            )}
          </div>
        ))}
      </div>
    </NotchPanel>
  );
}

function SearchRow({
  choice,
  index,
  active,
  onHover,
  onPick,
}: {
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
      id={`notch-choice-${index}`}
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
          {kind === "booking" ? <ReceiptIcon size={18} /> : <TicketIcon size={18} />}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold leading-[19px] text-[#c9cbd1]">
          {choice.label}
        </span>
        {hit && <span className="truncate text-[13px] leading-4 text-[#6e727c]">{hit.detail}</span>}
      </span>
      {active && (
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/12 text-white"
        >
          <EnterIcon size={14} />
        </span>
      )}
    </div>
  );
}

function NotificationsPanel({ onClose, onLoaded }: { onClose: () => void; onLoaded: () => void }) {
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

  return (
    <NotchPanel label="Notifications" onClose={onClose}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 pr-2 pl-2">
        <span className="text-base font-semibold leading-5 text-white">Notifications</span>
        <Link
          href="/app/parametres/paiements#notifications"
          onClick={onClose}
          className="text-[13px] font-semibold leading-4 text-notch-idle hover:text-on-ink"
        >
          Régler mes notifications
        </Link>
      </div>
      {items === null ? (
        <p className="px-2 pb-2 text-[15px] leading-[19px] text-[#6e727c]">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="px-2 pb-2 text-[15px] leading-[19px] text-[#c9cbd1]">
          Rien de neuf. Les nouvelles réservations, annulations et paiements arriveront ici.
        </p>
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
                      item.unread ? "text-white" : "text-[#c9cbd1]",
                    )}
                  >
                    {item.title}
                  </span>
                  {item.body && (
                    <span className="truncate text-[13px] leading-4 text-[#6e727c]">
                      {item.body}
                    </span>
                  )}
                </span>
                <span className="shrink-0 self-start pt-0.5 text-[13px] leading-4 text-[#6e727c]">
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
    </NotchPanel>
  );
}

/** Avatar du notch : ouvre le compte (paramètres, déconnexion). */
function AccountMenu({ user, workspace }: Pick<NotchProps, "user" | "workspace">) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <div className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`Compte de ${user.name}`}
        className="flex size-8 items-center justify-center rounded-full bg-linear-135 from-[#f2a15e] to-[#d2552f] text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
      >
        {initials(user.name)}
      </button>
      {open && (
        <>
          {/* Clic en dehors : on referme. */}
          <button
            type="button"
            aria-label="Fermer le menu du compte"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 -z-10 cursor-default"
          />
          <div className="absolute top-full right-0 mt-3 w-60 origin-top-right animate-pop rounded-2xl bg-surface p-2 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
            <div className="flex flex-col gap-0.5 px-3 pt-2 pb-3">
              <span className="truncate text-sm font-semibold leading-[18px] text-ink">
                {user.shortName}
              </span>
              <span className="truncate text-[13px] leading-4 text-ink-muted">
                {workspace.name}
              </span>
            </div>
            <Link
              href="/app/parametres"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-field"
            >
              Paramètres
            </Link>
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger-bg"
            >
              {pending ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
