"use client";

import {
  animate,
  cancelFrame,
  frame,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActiveIndicator } from "@/components/motion/indicator";
import { BellIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { Link, usePathname } from "@/lib/navigation";
import { useToast } from "@/lib/toast";
import { HorayaMark } from "./logo";
import {
  AccountPanel,
  activeSection,
  isActive,
  NAV,
  NotificationsPanel,
  SearchPanel,
  SectionPanel,
} from "./notch-panels";
import { NOTCH_BAR_HEIGHT, notchShape } from "./notch-shape";
import { NotchToast } from "./notch-toast";

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
/** Menu d'une section (son adresse) ou du bouton Créer. */
type MenuPanel = "create" | `/app/${string}`;
/** Chaque icône à panneau l'ouvre au survol (`data-notch-menu`), ou au clic. */
type Panel = "search" | "notifications" | "account" | MenuPanel | null;
const isMenu = (panel: Panel): panel is MenuPanel =>
  panel === "create" || Boolean(panel?.startsWith("/app"));

/** Agrandissement du notch (et retour) : ressort sans rebond, qui garde son élan si on l'interrompt. */
const GROW = { type: "spring", visualDuration: 0.36, bounce: 0 } as const;
/** Le contenu change de hauteur (résultats qui arrivent) : le notch suit, un peu plus vite. */
const FOLLOW = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
/** Languette sous le notch : glisse d'une icône à l'autre, sort et rentre sous le notch. */
const HINT = { type: "spring", visualDuration: 0.22, bounce: 0 } as const;
/** Rangée d'icônes du notch replié (mesurée au montage ; valeur du premier rendu). */
const BAR_INNER = 488;
/** Pause sur une icône avant que son panneau ne s'ouvre (un simple passage n'ouvre rien). */
const HOVER_DELAY = 120;
/** Largeur du notch agrandi (maquette : panneau de 624 px). */
const PANEL_MIN_INNER = 624;
/** Sur grand écran, panneau large (deux colonnes) ; les icônes, elles, ne bougent pas. */
const WIDE_INNER = 880;
const WIDE_MIN_WIDTH = 1280;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface NotchProps {
  user: { name: string; shortName: string; image: string | null; platformAdmin?: boolean };
  workspace: { name: string; slug: string };
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
  const [wide, setWide] = useState(false);
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
  /** Mesures : rangée repliée, notch agrandi, hauteur du contenu. */
  const dims = useRef({ bar: BAR_INNER, wide: PANEL_MIN_INNER, content: 0 });
  /** Ouverture (0 replié, 1 agrandi) et hauteur du contenu affichée, animées par Motion. */
  const progress = useMotionValue(0);
  const shown = useMotionValue(0);
  /** Où va le notch : 1 s'il s'ouvre, 0 s'il se referme. */
  const target = useRef(0);
  const reduced = useReducedMotion();
  const state = useRef({ panel });
  state.current = { panel };
  /**
   * Panneau tenu : ouvert au clic ou au clavier, ou touché (clic, frappe) après une ouverture au
   * survol. Il ne se referme plus quand la souris sort, ni ne change au survol d'une autre icône.
   */
  const pinned = useRef(false);
  const editing = useRef(false);
  const pendingOpen = useRef(false);
  /** Menu ouvert au clavier (flèche bas) : le focus va à sa première carte. */
  const focusFirst = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Menu de l'icône sous la souris. */
  const hovered = useRef<Panel | undefined>(undefined);

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
    (next: Exclude<Panel, null>, byHover = false) => {
      pinned.current = !byHover;
      // Ouverte au survol pendant une saisie, la recherche ne prend pas le curseur.
      editing.current =
        byHover &&
        Boolean(document.activeElement?.matches("input, textarea, select, [contenteditable]"));
      setClosing(false);
      setPanel(next);
      if (state.current.panel && target.current === 1) return;
      // Mesure du notch replié : rangée d'icônes.
      const d = dims.current;
      const row = rowRef.current;
      if (row && progress.get() === 0) d.bar = row.offsetWidth;
      const large = window.innerWidth >= WIDE_MIN_WIDTH;
      d.wide = Math.max(d.bar + 32, large ? WIDE_INNER : PANEL_MIN_INNER);
      setWide(large);
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
    if (focusFirst.current) {
      focusFirst.current = false;
      content.querySelector<HTMLElement>("a")?.focus();
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

  /** ⌘K ouvre la recherche, ou la referme si elle est déjà ouverte. */
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

  // Premier dessin à la taille réelle de la rangée.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (row) dims.current.bar = row.offsetWidth;
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

  // Un panneau s'ouvre, ou un message sort sous le notch : plus de libellé.
  const toastShown = useToast() !== null && !panel;
  useEffect(() => {
    if (panel || toastShown) hideHint();
  }, [panel, toastShown, hideHint]);

  /**
   * Libellé sous le notch (« sous-notch ») pour l'icône survolée ou focalisée : les icônes ne
   * bougent pas, la languette glisse de l'une à l'autre. Les espaces entre icônes la gardent.
   */
  function pointAt(target: EventTarget, root: HTMLElement, pointer = true) {
    if (!(target instanceof Element) || panel || toastShown || muted.current) return;
    const item = target.closest<HTMLElement>("[data-notch-label]");
    // À la souris, une icône à menu n'a pas de libellé : son menu s'ouvre, avec son titre.
    if (!item || (pointer && item.dataset.notchMenu)) {
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

  /**
   * Survol (seulement quand la souris bouge vraiment). Après une courte pause sur une icône, son
   * panneau s'ouvre ; si un panneau est déjà ouvert, on passe à l'autre aussitôt, comme dans une
   * barre de menus. Un panneau tenu ne change pas.
   */
  function hover(element: EventTarget) {
    if (!(element instanceof Element) || contentRef.current?.contains(element)) return;
    const menu = element.closest<HTMLElement>("[data-notch-menu]")?.dataset.notchMenu as
      | Exclude<Panel, null>
      | undefined;
    if (menu === hovered.current) return;
    hovered.current = menu;
    clearTimeout(hoverTimer.current);
    const current = state.current.panel;
    if (!menu || (current && pinned.current)) return;
    if (current && target.current === 1) open(menu, true);
    else hoverTimer.current = setTimeout(() => open(menu, true), HOVER_DELAY);
  }
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const closedWidth = BAR_INNER + 88;
  const activeHref = activeSection(pathname);
  const closed = notchShape(closedWidth, NOTCH_BAR_HEIGHT, 0);

  return (
    <>
      {/* Fondu sous le notch : le contenu s'efface avant de passer dessous (comme sur mobile). */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-1.5 top-1.5 z-40 hidden h-[72px] rounded-t-[10px] bg-linear-to-t from-bg/0 via-bg via-50% to-bg [view-transition-name:notch-fade] lg:block"
      />
      {/* Voile : seulement le contenu dans le cadre ; son opacité suit le notch. Sans flou : sur
          WebKit, un flou plein écran se recalcule à chaque image et l'animation saccade. */}
      {panel && (
        <button
          ref={veilRef}
          type="button"
          aria-label="Fermer"
          tabIndex={-1}
          onClick={close}
          style={{ opacity: 0 }}
          className={cn(
            "fixed inset-1.5 z-[45] hidden cursor-default rounded-[10px] bg-ink/35 lg:block",
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
          if (!event.movementX && !event.movementY) return;
          hover(event.target);
          if (!muted.current || panel) return;
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
          hovered.current = undefined;
          clearTimeout(hoverTimer.current);
          // Ouvert au survol et pas touché : il se referme dès que la souris s'en va.
          if (!pinned.current) close();
        }}
        onKeyDown={(event) => {
          const item =
            event.target instanceof Element &&
            event.target.closest<HTMLElement>("[data-notch-menu]");
          if (event.key !== "ArrowDown" || !item) return;
          event.preventDefault();
          focusFirst.current = true;
          open(item.dataset.notchMenu as Exclude<Panel, null>);
        }}
        onFocus={(event) => {
          // Focus rendu par le code (fermeture d'un panneau) : pas de libellé ; au clavier, si.
          if (!(event.target instanceof Element) || !event.target.matches(":focus-visible")) return;
          muted.current = false;
          pointAt(event.target, event.currentTarget, false);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) hideHint();
        }}
      >
        {/* Toujours monté (caché pendant un panneau) : il garde sa largeur et sa place. */}
        <SubNotch hint={hint} />
        <NotchToast hidden={Boolean(panel)} />
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
            aria-current={pathname === "/app" ? "page" : undefined}
            data-notch-label="Accueil"
            className="relative isolate flex size-10 items-center justify-center rounded-xl text-on-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
          >
            {pathname === "/app" && (
              <ActiveIndicator id="notch" className="inset-0 -z-10 rounded-xl bg-on-ink/16" />
            )}
            <HorayaMark size={18} />
          </Link>
          <Separator />
          <nav aria-label="Navigation principale" className="flex items-center gap-1.5">
            {NAV.map((item) => {
              const active = activeHref === item.href;
              const Icon = item.icon;
              const pending = item.href === "/app/reservations" && pendingBookings > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  data-notch-label={item.label}
                  data-notch-menu={item.href}
                  aria-expanded={panel === item.href}
                  data-notch-badge={pending ? `${pendingBookings} à valider` : undefined}
                  aria-current={active ? "page" : undefined}
                  aria-label={pending ? `${item.label}, ${pendingBookings} à valider` : item.label}
                  className={cn(
                    "relative isolate flex h-10 items-center rounded-xl px-2.5 transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
                    active
                      ? "text-on-ink"
                      : panel === item.href
                        ? "bg-white/8 text-on-ink"
                        : "text-notch-idle hover:text-on-ink",
                  )}
                >
                  {active && (
                    <ActiveIndicator id="notch" className="inset-0 -z-10 rounded-xl bg-on-ink/16" />
                  )}
                  <Icon size={20} />
                  {pending && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0.5 left-[22px] flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-ink bg-accent px-1 text-[10px] font-bold leading-none text-ink"
                    >
                      {pendingBookings > 99 ? "99+" : pendingBookings}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <Separator />
          <NotchButton
            label="Créer"
            hint="Créer"
            menu="create"
            onClick={() => open("create")}
            expanded={panel === "create"}
          >
            <PlusIcon size={20} />
          </NotchButton>
          <NotchButton
            label="Rechercher (⌘K)"
            hint="Rechercher"
            badge="⌘K"
            badgeTone="key"
            menu="search"
            onClick={() => open("search")}
            expanded={panel === "search"}
          >
            <SearchIcon size={20} />
          </NotchButton>
          <NotchButton
            label={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
            hint="Notifications"
            badge={unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : undefined}
            menu="notifications"
            onClick={() => open("notifications")}
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
            onClick={() => open("account")}
            aria-expanded={panel === "account"}
            aria-label={`Compte de ${user.name}`}
            data-notch-label="Mon compte"
            data-notch-menu="account"
            className={cn(
              "ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-on-ink transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
              (panel === "account" || isActive(pathname, "/app/parametres")) &&
                "ring-2 ring-on-ink/40 ring-offset-2 ring-offset-ink",
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
            // Toucher le panneau (clic, frappe) le tient ouvert.
            onPointerDownCapture={() => {
              pinned.current = true;
            }}
            onKeyDownCapture={() => {
              pinned.current = true;
            }}
            className="absolute top-14 left-1/2 -translate-x-1/2"
            style={{ opacity: 0, clipPath: "inset(0 50% 100% 50%)" }}
          >
            {panel === "search" && (
              <NotchPanel label="Recherche" onClose={close}>
                <SearchPanel onClose={close} wide={wide} focus={!editing.current} />
              </NotchPanel>
            )}
            {panel === "notifications" && (
              <NotchPanel label="Notifications" onClose={close}>
                <NotificationsPanel onClose={close} onLoaded={markRead} wide={wide} />
              </NotchPanel>
            )}
            {panel === "account" && (
              <NotchPanel label="Mon compte" onClose={close}>
                <AccountPanel user={user} workspace={workspace} onClose={close} wide={wide} />
              </NotchPanel>
            )}
            {isMenu(panel) && (
              <NotchPanel
                label={NAV.find((item) => item.href === panel)?.label ?? "Créer"}
                onClose={close}
              >
                <SectionPanel menu={panel} pending={pendingBookings} onClose={close} wide={wide} />
              </NotchPanel>
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
  menu,
  onClick,
  expanded,
  children,
}: {
  label: string;
  /** Texte de la languette sous le notch. */
  hint: string;
  badge?: string;
  badgeTone?: "key";
  /** Menu ouvert au survol (voir `MenuPanel`). */
  menu?: string;
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
      data-notch-menu={menu}
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
