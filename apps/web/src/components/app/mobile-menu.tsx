"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SOFT } from "@/components/motion/indicator";
import { Button } from "@/components/ui/button";
import {
  BellIcon,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalIcon,
  TicketIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Link, usePathname } from "@/lib/navigation";
import {
  AccountPanel,
  type AccountUser,
  GroupLabel,
  isActive,
  NAV,
  type NavItem,
  NotificationsPanel,
  SearchPanel,
} from "./notch-panels";

/** Écrans du notch (sauf les réglages, dans « Compte »), plus ceux qui n'ont pas d'onglet. */
const SCREENS: NavItem[] = [
  ...NAV.filter((item) => item.href !== "/app/parametres"),
  { href: "/app/evenements/types", label: "Types d'événements", icon: TicketIcon },
  { href: "/app/evenements/liens", label: "Liens calendrier", icon: CalendarIcon },
];

export interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  user: AccountUser;
  workspace: { name: string; slug: string };
  unread: number;
  /** Notifications ouvertes : tout passe en lu (doit rester stable, comme dans le notch). */
  onRead: () => void;
}

/**
 * Grand menu mobile (sous `lg`, ouvert par l'onglet « Plus » de la capsule) : tout ce que fait le
 * notch du haut sur ordi (recherche, créations, notifications, compte), plus la navigation
 * complète. La capsule du bas s'ouvre en panneau noir flottant (même marge de 12 px qu'elle) sur
 * un <dialog> natif (focus piégé, Échap, fond inerte) ; se referme dans la capsule en tirant la
 * poignée vers le bas, en touchant à côté ou avec « Fermer ».
 */
export function MobileMenu({ open, onClose, ...content }: MobileMenuProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  // Avant le dessin et avant l'effet du panneau, qui mesure la fenêtre ouverte.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open || dialog.open) return;
    opener.current = document.activeElement;
    dialog.showModal();
    // Premier focus sur « Fermer », pas sur la recherche (le clavier cacherait le menu), sans
    // défilement : Safari ferait défiler la fenêtre pendant l'ouverture pour le montrer.
    dialog.querySelector<HTMLElement>("[data-menu-close]")?.focus({ preventScroll: true });
    document.documentElement.style.overflow = "hidden";
  }, [open]);

  // Tablette tournée en grand écran : le notch du haut prend le relais.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (wide.matches) onClose();
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, onClose]);

  /** Fin de la sortie : la fenêtre se ferme, la page défile de nouveau, le focus revient. */
  function closed() {
    ref.current?.close();
    document.documentElement.style.overflow = "";
    if (opener.current instanceof HTMLElement) opener.current.focus();
  }

  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      aria-modal="true"
      onCancel={(event) => {
        // Échap : on garde la fenêtre le temps de l'animation de sortie.
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // `overflow-clip` : aucun défilement possible, même provoqué par le focus pendant l'animation.
      className="m-0 size-full max-h-none max-w-none overflow-clip bg-transparent p-0 backdrop:bg-transparent"
    >
      <AnimatePresence onExitComplete={closed}>
        {open && <Panel key="menu" onClose={onClose} {...content} />}
      </AnimatePresence>
    </dialog>
  );
}

/** Rayons de la capsule (bottom-notch.tsx) et du panneau ouvert. */
const CAPSULE_RADIUS = 24;
const PANEL_RADIUS = 28;

function Panel({ onClose, user, workspace, unread, onRead }: Omit<MobileMenuProps, "open">) {
  const [isPresent, safeToRemove] = usePresence();
  const panel = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"menu" | "notifications">("menu");
  /** Retour des notifications : le focus revient sur leur ligne. */
  const [back, setBack] = useState(false);
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : SOFT;

  /*
   * Comme le notch du bureau : le panneau est à sa taille finale et un `clip-path` le découpe,
   * de la capsule (0) au panneau entier (1). Rien n'est mis à l'échelle, le texte reste net.
   */
  const progress = useMotionValue(0);
  /** Écarts haut, droite, bas, gauche entre le panneau et la capsule. */
  const gap = useRef<number[] | null>(null);
  const clipPath = useTransform(progress, (v) => {
    if (!gap.current) return "inset(50%)";
    const [top, right, bottom, left] = gap.current.map((n) => n * (1 - v));
    const radius = CAPSULE_RADIUS + (PANEL_RADIUS - CAPSULE_RADIUS) * v;
    return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
  });
  const contentOpacity = useTransform(progress, [0.35, 1], [0, 1]);
  const contentY = useTransform(progress, [0, 1], [24, 0]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ouverture puis fermeture, une fois chacune
  useEffect(() => {
    const box = panel.current?.getBoundingClientRect();
    const capsule = document.querySelector("nav[data-bottom-bar]")?.getBoundingClientRect();
    if (box) {
      gap.current = capsule?.width
        ? [
            capsule.top - box.top,
            box.right - capsule.right,
            box.bottom - capsule.bottom,
            capsule.left - box.left,
          ]
        : // Sans capsule visible : le panneau naît du bas, au centre.
          [box.height, box.width / 2, 0, box.width / 2];
    }
    const controls = animate(progress, isPresent ? 1 : 0, transition);
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
        style={{ clipPath }}
        className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] bottom-[calc(12px+env(safe-area-inset-bottom))] flex flex-col overflow-hidden rounded-[28px] bg-ink text-on-ink"
      >
        <motion.div
          style={{ opacity: contentOpacity, y: contentY }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Poignée : tirée vers le bas, le panneau rentre dans la capsule sous le doigt. */}
          <motion.div
            onPan={(_, info) => {
              const top = gap.current?.[0];
              if (top) progress.set(Math.min(1, Math.max(0, 1 - info.offset.y / top)));
            }}
            onPanEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
              else animate(progress, 1, transition);
            }}
            className="shrink-0 touch-none px-4 pt-2 pb-3"
          >
            <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-on-ink/20" />
            <div className="mt-3 flex items-center justify-between gap-3">
              {view === "menu" ? (
                <h2 className="px-2 text-base font-semibold leading-5">Menu</h2>
              ) : (
                <Button
                  variant="inverse-outline"
                  size="xs"
                  icon={<ChevronLeft />}
                  onClick={() => {
                    setBack(true);
                    setView("menu");
                  }}
                  autoFocus
                >
                  Menu
                </Button>
              )}
              <Button variant="inverse-outline" size="xs" onClick={onClose} data-menu-close>
                Fermer
              </Button>
            </div>
          </motion.div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none px-4 pb-4">
            {view === "menu" ? (
              <div className="flex flex-col gap-3.5">
                <SearchPanel
                  sheet
                  wide={false}
                  onClose={onClose}
                  idle={
                    <>
                      <button
                        type="button"
                        onClick={() => setView("notifications")}
                        // biome-ignore lint/a11y/noAutofocus: retour des notifications
                        autoFocus={back}
                        className="flex h-14 items-center gap-3 rounded-[14px] px-2 text-left transition-colors hover:bg-white/8"
                      >
                        <span
                          aria-hidden="true"
                          className="relative flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/8 text-notch-idle"
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
                      <Screens slug={workspace.slug} onClose={onClose} />
                      <AccountPanel
                        user={user}
                        workspace={workspace}
                        onClose={onClose}
                        wide={false}
                      />
                    </>
                  }
                />
              </div>
            ) : (
              <NotificationsPanel onClose={onClose} onLoaded={onRead} wide={false} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

/** Toute la navigation, en tuiles ; la plus précise des correspondances est allumée. */
function Screens({ slug, onClose }: { slug: string; onClose: () => void }) {
  const pathname = usePathname();
  const current = SCREENS.filter((screen) => isActive(pathname, screen.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0]?.href;
  const tile =
    "flex min-h-14 items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold leading-[19px] transition-colors";
  return (
    <nav aria-label="Navigation complète" className="flex flex-col gap-1">
      <GroupLabel>Aller à</GroupLabel>
      <ul className="grid grid-cols-2 gap-2">
        {SCREENS.map(({ href, label, icon: Icon }) => (
          <li key={href} className="flex">
            <Link
              href={href}
              onClick={onClose}
              aria-current={href === current ? "page" : undefined}
              className={cn(
                tile,
                "flex-1",
                href === current
                  ? "bg-on-ink/16 text-on-ink"
                  : "bg-white/6 text-on-ink hover:bg-white/12",
              )}
            >
              <Icon size={20} className="shrink-0 text-notch-idle" />
              {label}
            </Link>
          </li>
        ))}
        <li className="flex">
          <Link
            href={`/${slug}`}
            onClick={onClose}
            className={cn(tile, "flex-1 bg-white/6 hover:bg-white/12")}
          >
            <ExternalIcon size={16} className="shrink-0 text-notch-idle" />
            Ma page publique
          </Link>
        </li>
      </ul>
    </nav>
  );
}
