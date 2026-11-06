"use client";

import {
  animate,
  cancelFrame,
  frame,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import { Link, usePathname, useRouter } from "@/lib/navigation";
import { HorayaMark } from "./logo";
import { NOTCH_BAR_HEIGHT, notchShape } from "./notch-shape";

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

/* Languette du libellé : les courbes en S du notch, ramenées à 32 px de haut (28 px de large). */
const TAB_EAR_LEFT = "M0 0 C15.3 0 12.7 32 28 32 L29 32 L29 0 Z";
const TAB_EAR_RIGHT = "M29 0 C13.7 0 16.3 32 1 32 L0 32 L0 0 Z";

/** Libellé survolé : centre de l'icône (dans le notch), texte, et s'il glisse depuis l'icône précédente. */
interface Hint {
  x: number;
  /** Largeur totale du notch : la languette reste sous son bas plat. */
  span: number;
  label: string;
  /** Pastille après le libellé : compteur (orange) ou raccourci clavier. */
  badge?: { text: string; tone: "count" | "key" };
  visible: boolean;
  slide: boolean;
}
type Panel = "search" | "notifications" | "account" | null;

/** Agrandissement du notch (et retour) : ressort sans rebond, qui garde son élan si on l'interrompt. */
const GROW = { type: "spring", visualDuration: 0.36, bounce: 0 } as const;
/** Le contenu change de hauteur (résultats qui arrivent) : le notch suit, un peu plus vite. */
const FOLLOW = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
/** Languette sous le notch : glisse d'une icône à l'autre, sort et rentre sous le notch. */
const HINT = { type: "spring", visualDuration: 0.22, bounce: 0 } as const;
/** Rangée d'icônes du notch replié (mesurée au montage ; valeur du premier rendu). */
const BAR_INNER = 530;
/** Largeur minimale du notch agrandi (maquette : panneau de 624 px). */
const PANEL_MIN_INNER = 624;
/** Libellés à droite des icônes dans le notch agrandi, si l'écran a la place. */
const LABELS_MIN_WIDTH = 1280;
/** Espace entre une icône et son libellé. */
const LABEL_GAP = 8;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface NotchProps {
  user: { name: string; shortName: string; image: string | null };
  workspace: { name: string };
  /** Réservations à valider : pastille orange sur l'icône. */
  pendingBookings: number;
  /** Notifications non lues : pastille sur la cloche. */
  unreadNotifications: number;
}

/**
 * Navigation de l'admin sur grand écran : le notch noir en haut, au centre (DA v4).
 * Un seul notch : la loupe, la cloche ou l'avatar l'agrandissent ; il garde ses icônes (avec leurs
 * libellés) et révèle le panneau dessous. La silhouette est un seul tracé SVG, et une seule
 * progression (0 → 1, valeur Motion) pilote largeur, hauteur, courbes, libellés, contenu et voile.
 */
export function Notch({ user, workspace, pendingBookings, unreadNotifications }: NotchProps) {
  const pathname = usePathname();
  const [hint, setHint] = useState<Hint | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [labels, setLabels] = useState(false);
  /** Le notch reprend sa taille ; le panneau disparaît à la fin. */
  const [closing, setClosing] = useState(false);
  const [unread, setUnread] = useState(unreadNotifications);
  useEffect(() => setUnread(unreadNotifications), [unreadNotifications]);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLButtonElement>(null);
  /** Mesures : rangée repliée, notch agrandi, libellés (éléments et largeurs), hauteur du contenu. */
  const dims = useRef({
    bar: BAR_INNER,
    wide: PANEL_MIN_INNER,
    texts: [] as HTMLElement[],
    labels: [] as number[],
    content: 0,
  });
  /** Ouverture (0 replié, 1 agrandi) et hauteur du contenu affichée, animées par Motion. */
  const progress = useMotionValue(0);
  const shown = useMotionValue(0);
  /** Où va le notch : 1 s'il s'ouvre, 0 s'il se referme. */
  const target = useRef(0);
  const reduced = useReducedMotion();
  const state = useRef({ panel, labels });
  state.current = { panel, labels };
  const pendingOpen = useRef(false);

  /** Dessine le notch à son ouverture courante. */
  const draw = useCallback(() => {
    const open = progress.get();
    const d = dims.current;
    // Replié : rangée + deux courbes de 44 px ; agrandi : largeur du panneau + deux de 28 px.
    const width = d.bar + 88 + (d.wide + 56 - (d.bar + 88)) * open;
    const height = NOTCH_BAR_HEIGHT + shown.get() * open;
    const shape = notchShape(width, height, open);
    const root = rootRef.current;
    if (root) {
      root.style.width = `${width}px`;
      root.style.height = `${height}px`;
    }
    const svg = svgRef.current;
    if (svg) {
      svg.setAttribute("width", `${width}`);
      svg.setAttribute("height", `${height}`);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    pathRef.current?.setAttribute("d", shape.d);
    const withLabels = state.current.labels ? open : 0;
    for (let index = 0; index < d.texts.length; index++) {
      const text = d.texts[index] as HTMLElement;
      text.style.width = `${(d.labels[index] ?? 0) * withLabels}px`;
      text.style.marginLeft = `${LABEL_GAP * withLabels}px`;
      text.style.opacity = `${withLabels}`;
    }
    const content = contentRef.current;
    if (content) {
      const side = Math.max(0, (d.wide - (width - 2 * shape.side)) / 2);
      const hidden = Math.max(0, d.content - shown.get() * open);
      content.style.width = `${d.wide}px`;
      content.style.clipPath = `inset(0 ${side}px ${hidden}px ${side}px round 0 0 ${shape.radius}px ${shape.radius}px)`;
      content.style.opacity = `${clamp01((open - 0.25) / 0.55)}`;
    }
    if (veilRef.current) veilRef.current.style.opacity = `${open}`;
  }, [progress, shown]);

  // Les deux valeurs bougent souvent dans la même image : un seul dessin, à l'étape de rendu.
  useEffect(() => {
    const schedule = () => frame.render(draw);
    const offProgress = progress.on("change", schedule);
    const offShown = shown.on("change", schedule);
    return () => {
      offProgress();
      offShown();
      cancelFrame(draw);
    };
  }, [progress, shown, draw]);

  const finish = useRef<() => void>(() => {});

  const animateTo = useCallback(
    (next: number) => {
      target.current = next;
      // Une animation interrompue ne termine pas : seul un vrai retour à 0 retire le panneau.
      const onComplete = next === 0 ? () => finish.current() : undefined;
      if (reduced) {
        progress.jump(next);
        onComplete?.();
      } else {
        animate(progress, next, { ...GROW, onComplete });
      }
    },
    [progress, reduced],
  );

  /** Le contenu ouvert change de taille : le notch suit. */
  const follow = useCallback(
    (height: number) => {
      if (reduced) shown.jump(height);
      else animate(shown, height, FOLLOW);
    },
    [shown, reduced],
  );

  finish.current = () => {
    setPanel(null);
    setClosing(false);
  };

  const open = useCallback(
    (next: Exclude<Panel, null>) => {
      setClosing(false);
      setPanel(next);
      if (state.current.panel && target.current === 1) return;
      // Mesures du notch replié : rangée d'icônes et largeur naturelle de chaque libellé.
      const d = dims.current;
      const row = rowRef.current;
      const withLabels = window.innerWidth >= LABELS_MIN_WIDTH;
      if (row && progress.get() === 0) {
        d.bar = row.offsetWidth;
        d.labels = d.texts.map((text) => text.scrollWidth);
      }
      const extra = withLabels ? d.labels.reduce((sum, width) => sum + width + LABEL_GAP, 0) : 0;
      d.wide = Math.max(d.bar + extra + 32, PANEL_MIN_INNER);
      state.current.labels = withLabels;
      setLabels(withLabels);
      pendingOpen.current = true;
    },
    [progress],
  );

  // Panneau monté : on mesure son contenu, puis le notch s'agrandit jusqu'à lui.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!panel || !content) return;
    const d = dims.current;
    d.content = content.offsetHeight;
    // Notch replié : il prend d'emblée la hauteur du contenu. Ouvert (autre panneau), il la rejoint.
    if (progress.get() === 0) shown.jump(d.content);
    else follow(d.content);
    if (pendingOpen.current) {
      pendingOpen.current = false;
      animateTo(1);
    }
    draw();
    const observer = new ResizeObserver(() => {
      if (content.offsetHeight === d.content) return;
      d.content = content.offsetHeight;
      follow(d.content);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [panel, animateTo, follow, draw, progress, shown]);

  const close = useCallback(() => {
    if (!state.current.panel || target.current === 0) return;
    setClosing(true);
    animateTo(0);
  }, [animateTo]);

  /** Un bouton du notch ouvre son panneau, ou le referme s'il est déjà ouvert. */
  const toggle = useCallback(
    (next: Exclude<Panel, null>) => {
      if (state.current.panel === next && target.current === 1) close();
      else open(next);
    },
    [open, close],
  );

  // ⌘K / Ctrl K ouvre ou ferme la recherche, où que l'on soit.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle("search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Premier dessin à la taille réelle de la rangée ; les libellés sont gardés pour le dessin.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (row) {
      dims.current.bar = row.offsetWidth;
      dims.current.texts = [...row.querySelectorAll<HTMLElement>("[data-notch-text]")];
    }
    draw();
    return () => {
      progress.stop();
      shown.stop();
    };
  }, [draw, progress, shown]);

  /**
   * Après un clic dans le notch, plus de libellé tant que la souris n'a pas vraiment bougé : en se
   * repliant, le notch déplace ses icônes sous le curseur immobile, et le navigateur signale alors
   * un survol qui ferait réapparaître un libellé.
   */
  const muted = useRef(false);
  const hideHint = useCallback(
    () => setHint((current) => current && { ...current, visible: false }),
    [],
  );

  // Changement de page : le cadre et le notch restent, seule la page change. Si le notch est
  // ouvert, il se referme avec son animation (souvent déjà lancée par le clic).
  // biome-ignore lint/correctness/useExhaustiveDependencies: déclenché par la navigation
  useEffect(() => {
    close();
  }, [pathname]);

  // Un panneau s'ouvre : plus de libellé.
  useEffect(() => {
    if (panel) hideHint();
  }, [panel, hideHint]);

  /**
   * Libellé sous le notch (« sous-notch ») pour l'icône survolée ou focalisée : les icônes ne
   * bougent pas, la languette glisse de l'une à l'autre. Les espaces entre icônes la gardent.
   */
  function pointAt(target: EventTarget, root: HTMLElement) {
    if (!(target instanceof Element) || panel || muted.current) return;
    const item = target.closest<HTMLElement>("[data-notch-label]");
    if (!item) {
      if (target.closest("a, button")) hideHint();
      return;
    }
    const rect = item.getBoundingClientRect();
    const bar = root.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - bar.left;
    const label = item.dataset.notchLabel ?? "";
    const { notchBadge, notchBadgeTone } = item.dataset;
    setHint((current) => ({
      x,
      span: bar.width,
      label,
      badge: notchBadge
        ? { text: notchBadge, tone: notchBadgeTone === "key" ? "key" : "count" }
        : undefined,
      visible: true,
      slide: current?.visible ?? false,
    }));
  }
  const markRead = useCallback(() => setUnread(0), []);
  const closedWidth = BAR_INNER + 88;
  const closed = notchShape(closedWidth, NOTCH_BAR_HEIGHT, 0);

  return (
    <>
      {/* Fondu sous le notch : le contenu s'efface avant de passer dessous (comme sur mobile). */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-1.5 top-1.5 z-40 hidden h-[72px] rounded-t-[10px] bg-linear-to-t from-bg/0 via-bg via-50% to-bg [view-transition-name:notch-fade] lg:block"
      />
      {/* Voile de la maquette : seulement le contenu dans le cadre ; son opacité suit le notch. */}
      {panel && (
        <button
          ref={veilRef}
          type="button"
          aria-label="Fermer"
          tabIndex={-1}
          onClick={close}
          style={{ opacity: 0 }}
          className={cn(
            "fixed inset-1.5 z-[45] hidden cursor-default rounded-[10px] bg-ink/22 backdrop-blur-[3px] lg:block",
            closing && "pointer-events-none",
          )}
        />
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: survol et focus montrent le libellé, sans action */}
      <div
        ref={rootRef}
        data-tour="notch"
        className="fixed top-0 left-1/2 z-50 hidden -translate-x-1/2 [view-transition-name:notch] lg:block"
        style={{ width: closedWidth, height: NOTCH_BAR_HEIGHT }}
        onMouseOver={(event) => pointAt(event.target, event.currentTarget)}
        onPointerMove={(event) => {
          if (!muted.current || panel || (!event.movementX && !event.movementY)) return;
          muted.current = false;
          pointAt(event.target, event.currentTarget);
        }}
        onClickCapture={() => {
          muted.current = true;
          hideHint();
        }}
        onMouseLeave={() => {
          muted.current = false;
          hideHint();
        }}
        onFocus={(event) => {
          // Focus rendu par le code (fermeture d'un panneau) : pas de libellé ; au clavier, si.
          if (!(event.target instanceof Element) || !event.target.matches(":focus-visible")) return;
          muted.current = false;
          pointAt(event.target, event.currentTarget);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) hideHint();
        }}
      >
        {/* Toujours monté (caché pendant un panneau) : il garde sa largeur et sa place. */}
        <SubNotch hint={hint} />
        <svg
          ref={svgRef}
          aria-hidden="true"
          width={closedWidth}
          height={NOTCH_BAR_HEIGHT}
          viewBox={`0 0 ${closedWidth} ${NOTCH_BAR_HEIGHT}`}
          className="pointer-events-none absolute top-0 left-0"
        >
          <path ref={pathRef} d={closed.d} className="fill-ink" />
        </svg>
        <div
          ref={rowRef}
          className="absolute top-[3px] left-1/2 flex h-[50px] -translate-x-1/2 items-center gap-1.5"
        >
          <Link
            href="/app"
            onClick={close}
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
                  onClick={close}
                  data-notch-label={item.label}
                  data-notch-badge={pending ? `${pendingBookings} à valider` : undefined}
                  aria-current={active ? "page" : undefined}
                  aria-label={pending ? `${item.label}, ${pendingBookings} à valider` : item.label}
                  className={cn(
                    "relative isolate flex h-10 items-center rounded-xl px-2.5 transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
                    active ? "text-on-ink" : "text-notch-idle hover:text-on-ink",
                  )}
                >
                  {active && (
                    <ActiveIndicator id="notch" className="inset-0 -z-10 rounded-xl bg-on-ink/16" />
                  )}
                  <Icon size={20} />
                  <span
                    aria-hidden="true"
                    data-notch-text
                    className="overflow-hidden whitespace-nowrap text-sm font-semibold leading-[18px]"
                    style={{ width: 0, opacity: 0 }}
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
            hint="Rechercher"
            badge="⌘K"
            badgeTone="key"
            onClick={() => toggle("search")}
            expanded={panel === "search"}
          >
            <SearchIcon size={20} />
          </NotchButton>
          <NotchButton
            label={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
            hint="Notifications"
            badge={unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : undefined}
            onClick={() => toggle("notifications")}
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
          <button
            type="button"
            onClick={() => toggle("account")}
            aria-expanded={panel === "account"}
            aria-label={`Compte de ${user.name}`}
            data-notch-label="Mon compte"
            className={cn(
              "ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-135 from-[#f2a15e] to-[#d2552f] text-xs font-bold text-white transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
              panel === "account" && "ring-2 ring-on-ink/40 ring-offset-2 ring-offset-ink",
            )}
          >
            {user.image ? (
              <img src={user.image} alt="" className="size-full rounded-full object-cover" />
            ) : (
              initials(user.name)
            )}
          </button>
        </div>
        {/* Le panneau, posé à sa taille finale sous les icônes : la silhouette le révèle. */}
        {panel && (
          <div
            ref={contentRef}
            className="absolute top-14 left-1/2 -translate-x-1/2"
            style={{ opacity: 0, clipPath: "inset(0 50% 100% 50%)" }}
          >
            {panel === "search" && <SearchPanel onClose={close} wide={labels} />}
            {panel === "notifications" && (
              <NotificationsPanel onClose={close} onLoaded={markRead} wide={labels} />
            )}
            {panel === "account" && (
              <AccountPanel user={user} workspace={workspace} onClose={close} wide={labels} />
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Separator() {
  return <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-white/22" />;
}

/** Petit notch sous le notch (mêmes courbes en S), avec le libellé survolé. */
function SubNotch({ hint }: { hint: Hint | null }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();
  const content = `${hint?.label}|${hint?.badge?.text}`;
  // Première mesure posée telle quelle ; ensuite la largeur suit le libellé.
  const measured = useRef(false);
  useEffect(() => {
    if (width !== undefined) measured.current = true;
  }, [width]);
  const reduced = useReducedMotion();

  // biome-ignore lint/correctness/useExhaustiveDependencies: on mesure à chaque nouveau libellé
  useLayoutEffect(() => {
    if (textRef.current) setWidth(textRef.current.offsetWidth + 12);
  }, [content]);

  if (!hint) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute top-14 left-0"
      initial={false}
      animate={{
        // Centrée sous l'icône, sans que ses courbes (28 px) dépassent le bas plat du notch (44 px de bord).
        x: Math.min(Math.max(hint.x - (width ?? 0) / 2, 72), hint.span - 72 - (width ?? 0)),
      }}
      transition={hint.slide ? HINT : { duration: 0 }}
    >
      <motion.div
        className="relative"
        // Rentré sous le notch, il devient invisible : ses bords ne dépassent jamais des courbes.
        initial={{ y: "-100%", visibility: "hidden" }}
        animate={
          hint.visible
            ? { y: 0, visibility: "visible" }
            : { y: "-100%", transitionEnd: { visibility: "hidden" } }
        }
        transition={HINT}
      >
        <svg
          width="29"
          height="32"
          viewBox="0 0 29 32"
          aria-hidden="true"
          className="absolute top-0 right-[calc(100%-1px)]"
        >
          <path d={TAB_EAR_LEFT} className="fill-ink" />
        </svg>
        <svg
          width="29"
          height="32"
          viewBox="0 0 29 32"
          aria-hidden="true"
          className="absolute top-0 left-[calc(100%-1px)]"
        >
          <path d={TAB_EAR_RIGHT} className="fill-ink" />
        </svg>
        <motion.div
          className="flex h-8 items-center justify-center overflow-hidden bg-ink"
          initial={false}
          animate={width === undefined ? undefined : { width }}
          transition={measured.current && !reduced ? HINT : { duration: 0 }}
        >
          <span
            ref={textRef}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold leading-[18px] text-on-ink"
          >
            {hint.label}
            {hint.badge && (
              <span
                className={cn(
                  "flex h-5 items-center rounded-full px-2 text-xs font-bold leading-4",
                  hint.badge.tone === "count"
                    ? "bg-accent text-ink"
                    : "border border-white/20 font-semibold text-notch-idle",
                )}
              >
                {hint.badge.text}
              </span>
            )}
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function NotchButton({
  label,
  hint,
  badge,
  badgeTone,
  onClick,
  expanded,
  children,
}: {
  label: string;
  /** Texte de la languette sous le notch. */
  hint: string;
  badge?: string;
  badgeTone?: "key";
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
      data-notch-label={hint}
      data-notch-badge={badge}
      data-notch-badge-tone={badgeTone}
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
        expanded ? "bg-on-ink/16 text-on-ink" : "text-notch-idle hover:text-on-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Contenu révélé par le notch agrandi (recherche, notifications, compte). */
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
      className="flex max-h-[calc(100dvh-96px)] w-full flex-col gap-3.5 overflow-y-auto scrollbar-none px-4 pt-1 pb-5"
    >
      {children}
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

function SearchPanel({ onClose, wide }: { onClose: () => void; wide: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(NO_RESULTS);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  const searching = trimmed.length >= 2;

  // Sans recherche : raccourcis (à valider, prochains événements), chargés aussitôt.
  const request = searching ? trimmed : "";
  useEffect(() => {
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
  }, [request]);

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
              Événement « <span className="font-bold text-white">{trimmed}</span> »
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
  const mainGroups = groups.filter((group) => group !== CREATE_GROUP);
  const nothing = !loading && mainGroups.length === 0;

  const renderGroup = (group: string) => (
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
  );

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
      <div
        id="notch-search-results"
        role="listbox"
        ref={listRef}
        className={wide ? "grid grid-cols-[minmax(0,1fr)_280px] gap-6" : "flex flex-col gap-3.5"}
      >
        {/* Résultats (ou raccourcis) à gauche. */}
        <div className="flex min-w-0 flex-col gap-3.5">
          {nothing && (
            <p className="px-2 py-3 text-[15px] leading-[19px] text-[#c9cbd1]">
              {searching
                ? `Rien ne correspond à « ${trimmed} ».`
                : "Rien à valider, aucun événement à venir."}
            </p>
          )}
          {mainGroups.map(renderGroup)}
        </div>
        {/* Créer et raccourcis clavier à droite. */}
        <div className={cn("flex flex-col gap-3.5", wide && "border-l border-white/8 pl-6")}>
          {renderGroup(CREATE_GROUP)}
          <div
            className={cn(
              "flex px-2 text-[13px] leading-4 text-[#6e727c]",
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
        </div>
      </div>
    </NotchPanel>
  );
}

const CREATE_GROUP = "Créer";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/15 px-1 font-sans text-xs font-semibold text-notch-idle">
      {children}
    </kbd>
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

function NotificationsPanel({
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
    <NotchPanel label="Notifications" onClose={onClose}>
      <div
        className={wide ? "grid grid-cols-[minmax(0,1fr)_280px] gap-6" : "flex flex-col gap-3.5"}
      >
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
            <span className="text-base font-semibold leading-5 text-white">Notifications</span>
          )}
          <p className="text-[13px] leading-[18px] text-[#6e727c]">
            Nouvelles réservations, annulations par tes clients et paiements arrivent ici. Tu
            choisis ce qui te prévient, dans l'app ou par e-mail.
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
    </NotchPanel>
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
        <p className="px-2 py-3 text-[15px] leading-[19px] text-[#6e727c]">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="px-2 py-3 text-[15px] leading-[19px] text-[#c9cbd1]">Rien de neuf.</p>
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

/** Le compte, comme la recherche et les notifications : le notch descend en panneau. */
function AccountPanel({
  user,
  workspace,
  onClose,
  wide,
}: Pick<NotchProps, "user" | "workspace"> & { onClose: () => void; wide: boolean }) {
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
    <NotchPanel label="Mon compte" onClose={onClose}>
      <div
        className={wide ? "grid grid-cols-[minmax(0,1fr)_280px] gap-6" : "flex flex-col gap-3.5"}
      >
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
                <span className="truncate text-[15px] font-semibold leading-[19px] text-white">
                  {link.label}
                </span>
                <span className="truncate text-[13px] leading-4 text-[#6e727c]">{link.detail}</span>
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
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-135 from-[#f2a15e] to-[#d2552f] text-sm font-bold text-white"
            >
              {user.image ? (
                <img src={user.image} alt="" className="size-full rounded-full object-cover" />
              ) : (
                initials(user.name)
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-base font-semibold leading-5 text-white">
                {user.name}
              </span>
              <span className="truncate text-[13px] leading-4 text-[#6e727c]">
                {workspace.name}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className={cn(row, "text-[#ff9f80]", wide && "mt-auto")}
          >
            {pending ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </div>
    </NotchPanel>
  );
}
