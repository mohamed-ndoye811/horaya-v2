"use client";

import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { SOFT } from "@/components/motion/indicator";
import { Button } from "@/components/ui/button";
import {
  BellIcon,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  ExternalIcon,
  MenuIcon,
  PlusIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Link, usePathname } from "@/lib/navigation";
import { BottomNotch } from "./bottom-notch";
import { HorayaMark } from "./logo";
import {
  AccountPanel,
  type AccountUser,
  activeSection,
  CREATE_LINKS,
  GroupLabel,
  HOME,
  isActive,
  NAV,
  NotificationsPanel,
  SearchPanel,
} from "./notch-panels";

export interface MobileMenuProps {
  user: AccountUser;
  workspace: { name: string; slug: string };
  unread: number;
  pending: number;
}

/**
 * Menu mobile (sous `lg`, repris de la V1) : une pilule noire en bas de l'écran, qui grandit vers
 * le haut et devient le menu entier, comme le notch du bureau. Tout ce que fait le notch
 * (recherche, créations, notifications, compte) plus la navigation complète. La pilule garde sa
 * place au pied du panneau, son icône passe de ☰ à ✕. Ouvert, c'est un <dialog> natif (focus
 * piégé, Échap, fond inerte) ; se ferme sur la pilule, en touchant à côté ou avec Échap.
 */
export function MobileMenu({ user, workspace, unread: unreadAtLoad, pending }: MobileMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(unreadAtLoad);
  useEffect(() => setUnread(unreadAtLoad), [unreadAtLoad]);
  const close = useCallback(() => setOpen(false), []);
  const markRead = useCallback(() => setUnread(0), []);
  // Changement de page (lien du menu, recherche) : le menu se referme.
  // biome-ignore lint/correctness/useExhaustiveDependencies: déclenché par la navigation
  useEffect(() => setOpen(false), [pathname]);

  const ref = useRef<HTMLDialogElement>(null);
  const pill = useRef<HTMLButtonElement>(null);

  // Avant le dessin et avant l'effet du panneau, qui mesure la fenêtre ouverte.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open || dialog.open) return;
    dialog.showModal();
    // Focus sur le panneau (sans contour, tabindex -1), pas sur la recherche (le clavier
    // cacherait le menu) ni sur la pilule (anneau de focus au toucher), sans défilement : Safari
    // ferait défiler la fenêtre pendant l'ouverture pour le montrer.
    dialog.querySelector<HTMLElement>("[data-menu-panel]")?.focus({ preventScroll: true });
    document.documentElement.style.overflow = "hidden";
  }, [open]);

  // Tablette tournée en grand écran : le notch du haut prend le relais.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (wide.matches) close();
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, close]);

  /** Fin de la fermeture : la fenêtre se ferme, la page défile de nouveau, le focus revient. */
  function closed() {
    ref.current?.close();
    document.documentElement.style.overflow = "";
    pill.current?.focus({ preventScroll: true });
  }

  const dot = unread > 0 || pending > 0;
  const notices = [
    unread > 0 && `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}`,
    pending > 0 && `${pending} réservation${pending > 1 ? "s" : ""} à valider`,
  ].filter(Boolean);

  return (
    <>
      <BottomNotch label="Navigation principale">
        <button
          ref={pill}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={["Menu", ...notices].join(", ")}
          className={pillClasses}
        >
          <PillContent name={workspace.name} dot={dot} icon={<MenuIcon />} />
        </button>
      </BottomNotch>
      <dialog
        ref={ref}
        aria-label="Menu"
        aria-modal="true"
        onCancel={(event) => {
          // Échap : on garde la fenêtre le temps de l'animation de fermeture.
          event.preventDefault();
          close();
        }}
        onClose={close}
        // Sans le fondu ni le glissement des fenêtres (app.css, hors couche : seul le style en
        // ligne passe devant) : la pilule seule fait l'animation.
        style={{ transition: "none", opacity: 1, scale: "1", translate: "none" }}
        // `overflow-clip` : aucun défilement possible, même provoqué par le focus pendant l'animation.
        className="m-0 size-full max-h-none max-w-none overflow-clip bg-transparent p-0 backdrop:bg-transparent"
      >
        <AnimatePresence onExitComplete={closed}>
          {open && (
            <Panel
              key="menu"
              pill={pill}
              dot={dot}
              onClose={close}
              onRead={markRead}
              user={user}
              workspace={workspace}
              unread={unread}
              pending={pending}
            />
          )}
        </AnimatePresence>
      </dialog>
    </>
  );
}

const pillClasses =
  "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-on-ink";

/** Contenu de la pilule, identique fermée et au pied du panneau : il ne bouge pas d'un pixel. */
function PillContent({ name, dot, icon }: { name: string; dot: boolean; icon: ReactNode }) {
  return (
    <>
      <span className="relative shrink-0">
        <HorayaMark size={20} />
        {dot && (
          <span className="absolute -top-1 -right-1.5 size-[9px] rounded-full border-2 border-ink bg-accent" />
        )}
      </span>
      <span className="max-w-[180px] truncate text-[15px] font-semibold leading-5">{name}</span>
      <span className="flex size-5 shrink-0 items-center justify-center text-notch-idle">
        {icon}
      </span>
    </>
  );
}

/** ☰ qui laisse place à ✕ au fil de l'ouverture. */
function MenuCloseIcon({ progress }: { progress: MotionValue<number> }) {
  const menu = useTransform(progress, [0, 0.5], [1, 0]);
  const cross = useTransform(progress, [0.5, 1], [0, 1]);
  const turn = useTransform(progress, [0.5, 1], [-90, 0]);
  return (
    <span className="relative flex size-5 items-center justify-center">
      <motion.span style={{ opacity: menu }} className="absolute">
        <MenuIcon />
      </motion.span>
      <motion.span style={{ opacity: cross, rotate: turn }} className="absolute">
        <CloseIcon size={13} />
      </motion.span>
    </span>
  );
}

function Panel({
  pill,
  dot,
  onClose,
  onRead,
  user,
  workspace,
  unread,
  pending,
}: MobileMenuProps & {
  pill: RefObject<HTMLButtonElement | null>;
  dot: boolean;
  onClose: () => void;
  /** Notifications ouvertes : tout passe en lu (doit rester stable, comme dans le notch). */
  onRead: () => void;
}) {
  const [isPresent, safeToRemove] = usePresence();
  const panel = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"menu" | "notifications">("menu");
  /** Retour des notifications : le focus revient sur leur ligne. */
  const [back, setBack] = useState(false);
  const reduce = useReducedMotion();

  /*
   * Comme le notch du bureau : le panneau est à sa taille finale et un `clip-path` le découpe,
   * de la pilule (0) au panneau entier (1). Rien n'est mis à l'échelle, le texte reste net.
   */
  const progress = useMotionValue(0);
  /** Écarts haut, droite, bas, gauche entre le panneau et la pilule, et rayon de la pilule. */
  const from = useRef<{ gap: number[]; radius: number } | null>(null);
  const clipPath = useTransform(progress, (v) => {
    if (!from.current) return "inset(50%)";
    const [top, right, bottom, left] = from.current.gap.map((n) => n * (1 - v));
    const radius = from.current.radius + (PANEL_RADIUS - from.current.radius) * v;
    return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
  });
  const contentOpacity = useTransform(progress, [0.3, 1], [0, 1]);
  const contentY = useTransform(progress, [0, 1], [32, 0]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ouverture puis fermeture, une fois chacune
  useEffect(() => {
    const box = panel.current?.getBoundingClientRect();
    const start = pill.current?.getBoundingClientRect();
    if (box && start?.width) {
      from.current = {
        gap: [
          start.top - box.top,
          box.right - start.right,
          box.bottom - start.bottom,
          start.left - box.left,
        ],
        radius: start.height / 2,
      };
    }
    const controls = animate(progress, isPresent ? 1 : 0, reduce ? { duration: 0 } : SOFT);
    if (!isPresent) controls.then(safeToRemove);
    return () => controls.stop();
  }, [isPresent]);

  return (
    <>
      {/* Toucher à côté ferme ; pas de voile : la page reste dans les teintes des barres de Safari. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer le menu"
        onClick={onClose}
        className="absolute inset-0 cursor-default touch-none"
      />
      <motion.div
        ref={panel}
        tabIndex={-1}
        data-menu-panel
        style={{ clipPath }}
        className="absolute inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] flex max-h-[calc(100%-24px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col rounded-[28px] outline-none bg-ink text-on-ink"
      >
        <motion.div
          style={{ opacity: contentOpacity, y: contentY }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none px-4 pt-4 pb-1"
        >
          {view === "menu" ? (
            <div className="flex flex-col gap-3.5">
              <SearchPanel
                sheet
                wide={false}
                onClose={onClose}
                idle={
                  <>
                    <div className="flex flex-col gap-1">
                      <GroupLabel>Créer</GroupLabel>
                      <div className="flex flex-wrap gap-2">
                        {CREATE_LINKS.slice(0, 3).map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={onClose}
                            className="flex h-10 items-center gap-1.5 rounded-full bg-white/8 pr-3.5 pl-3 text-sm font-semibold leading-[18px] text-on-ink transition-colors hover:bg-white/12"
                          >
                            <PlusIcon size={14} className="text-accent" />
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setView("notifications")}
                      // biome-ignore lint/a11y/noAutofocus: retour des notifications
                      autoFocus={back}
                      className="flex h-12 items-center gap-3 rounded-[14px] px-2 text-left transition-colors hover:bg-white/8"
                    >
                      <span
                        aria-hidden="true"
                        className="relative flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white/8 text-notch-idle"
                      >
                        <BellIcon size={18} />
                        {unread > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 size-[9px] rounded-full border-2 border-ink bg-accent" />
                        )}
                      </span>
                      <span className="flex-1 text-[15px] font-semibold leading-[19px]">
                        Notifications
                      </span>
                      {unread > 0 && (
                        <span className="flex h-5 items-center rounded-full bg-accent px-2 text-xs font-bold leading-4 text-ink">
                          {unread} non lue{unread > 1 ? "s" : ""}
                        </span>
                      )}
                      <ChevronRight className="text-on-ink-subtle" />
                    </button>
                    <Screens slug={workspace.slug} pending={pending} onClose={onClose} />
                    <AccountPanel
                      user={user}
                      workspace={workspace}
                      onClose={onClose}
                      wide={false}
                      compact
                    />
                  </>
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                variant="inverse-outline"
                size="xs"
                icon={<ChevronLeft />}
                onClick={() => {
                  setBack(true);
                  setView("menu");
                }}
                autoFocus
                className="self-start"
              >
                Menu
              </Button>
              <NotificationsPanel onClose={onClose} onLoaded={onRead} wide={false} />
            </div>
          )}
        </motion.div>
        {/* La pilule, restée à sa place : la toucher referme. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className={cn(pillClasses, "shrink-0")}
        >
          <PillContent
            name={workspace.name}
            dot={dot}
            icon={<MenuCloseIcon progress={progress} />}
          />
        </button>
      </motion.div>
    </>
  );
}

const PANEL_RADIUS = 28;

/**
 * Toute la navigation : une ligne par section, avec à droite les pages de son menu (les mêmes
 * que la languette du notch). La plus précise des correspondances est allumée.
 */
function Screens({
  slug,
  pending,
  onClose,
}: {
  slug: string;
  pending: number;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const section = pathname === "/app" ? "/app" : activeSection(pathname);
  const sub = NAV.flatMap((item) => item.links)
    .filter((link) => link.chip && isActive(pathname, link.href))
    .map((link) => link.href)[0];
  const tile =
    "flex h-11 items-center rounded-[14px] text-[15px] font-semibold leading-[19px] transition-colors";
  const tone = (current: boolean) =>
    current ? "bg-on-ink/16 text-on-ink" : "bg-white/6 text-on-ink hover:bg-white/12";
  return (
    <nav aria-label="Navigation complète" className="flex flex-col gap-1">
      <GroupLabel>Aller à</GroupLabel>
      <ul className="flex flex-col gap-1.5">
        {[HOME, ...NAV].map((item) => {
          const Icon = item.icon;
          const current = item.href === section && !sub;
          return (
            <li key={item.href} className="flex gap-1.5">
              <Link
                href={item.href}
                onClick={onClose}
                aria-current={current ? "page" : undefined}
                className={cn(tile, "min-w-0 flex-1 gap-3 px-3.5", tone(current))}
              >
                <Icon size={20} className="shrink-0 text-notch-idle" />
                <span className="truncate">{item.label}</span>
                {item.href === "/app/reservations" && pending > 0 && (
                  <span className="ml-auto flex h-5 items-center rounded-full bg-accent px-2 text-xs font-bold leading-4 text-ink">
                    {pending} à valider
                  </span>
                )}
              </Link>
              {item.links
                .filter((link) => link.chip)
                .map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    aria-label={link.label}
                    aria-current={link.href === sub ? "page" : undefined}
                    className={cn(tile, "shrink-0 px-3.5 text-[13px]", tone(link.href === sub))}
                  >
                    {link.chip}
                  </Link>
                ))}
            </li>
          );
        })}
        <li className="flex">
          <Link
            href={`/${slug}`}
            onClick={onClose}
            className={cn(tile, "flex-1 gap-3 bg-white/6 px-3.5 hover:bg-white/12")}
          >
            <ExternalIcon size={16} className="shrink-0 text-notch-idle" />
            Ma page publique
          </Link>
        </li>
      </ul>
    </nav>
  );
}
