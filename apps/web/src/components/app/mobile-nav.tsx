"use client";

import { ArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { backLink, isFormPage } from "@/lib/mobile-nav";
import { Link, usePathname } from "@/lib/navigation";
import { MobileMenu, type MobileMenuProps } from "./mobile-menu";

/*
 * Navigation mobile de l'admin : un lien de retour en haut des fiches, et la pilule noire du
 * menu en bas de l'écran (mobile-menu.tsx), sous un fondu. Masqués à partir de `lg`, où le notch
 * du haut prend le relais.
 */

/**
 * Retour vers la liste ou la fiche parente (« ← Réservations »), hors onglets. Aussi sur grand
 * écran, sauf quand il mène à l'onglet Plus, propre au mobile.
 */
export function MobileTopBar() {
  const pathname = usePathname();
  const back = backLink(pathname);
  if (!back) return null;
  return (
    <div className={cn("px-4 pt-4", back.href === "/app/plus" && "lg:hidden")}>
      {/* Zone de toucher de 44 px de haut, sans décaler la page. */}
      <Link
        href={back.href}
        className="-mx-2 -my-3.5 flex w-fit items-center gap-1.5 px-2 py-3.5 text-[13px] font-semibold leading-4 text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3" />
        {back.label}
      </Link>
    </div>
  );
}

export function MobileTabBar({
  pendingBookings,
  unreadNotifications,
  user,
  workspace,
}: {
  pendingBookings: number;
  unreadNotifications: number;
} & Pick<MobileMenuProps, "user" | "workspace">) {
  const pathname = usePathname();
  // Formulaire : pas de menu, seulement la place de sa barre d'actions.
  if (isFormPage(pathname)) {
    return (
      <div aria-hidden="true" className="h-[calc(80px+env(safe-area-inset-bottom))] lg:hidden" />
    );
  }
  return (
    <MobileMenu
      user={user}
      workspace={workspace}
      unread={unreadNotifications}
      pending={pendingBookings}
    />
  );
}
