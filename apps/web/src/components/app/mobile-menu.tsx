"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
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
 * complète. Feuille noire qui monte du bas sur un <dialog> natif (focus piégé, Échap, fond
 * inerte) ; se ferme en glissant vers le bas, en touchant le fond ou avec « Fermer ».
 */
export function MobileMenu({ open, onClose, ...content }: MobileMenuProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open || dialog.open) return;
    opener.current = document.activeElement;
    dialog.showModal();
    // Premier focus sur « Fermer », pas sur la recherche (le clavier cacherait le menu), sans
    // défilement : la feuille est encore sous l'écran, Safari la ferait défiler pour la montrer.
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
        {open && <Sheet key="menu" onClose={onClose} {...content} />}
      </AnimatePresence>
    </dialog>
  );
}

function Sheet({ onClose, user, workspace, unread, onRead }: Omit<MobileMenuProps, "open">) {
  const drag = useDragControls();
  const [view, setView] = useState<"menu" | "notifications">("menu");
  /** Retour des notifications : le focus revient sur leur ligne. */
  const [back, setBack] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label="Fermer le menu"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SOFT}
        className="absolute inset-0 cursor-default touch-none bg-ink/40"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SOFT}
        drag="y"
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 500) onClose();
        }}
        className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] bottom-0 flex flex-col rounded-t-[28px] bg-ink text-on-ink"
      >
        {/* Poignée : on tire la feuille vers le bas depuis ici (le contenu, lui, défile). */}
        <div
          onPointerDown={(event) => drag.start(event)}
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
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
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
