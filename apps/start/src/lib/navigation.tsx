/**
 * Navigation de l'app, sur le routeur TanStack. Mêmes noms que l'ancienne app Next.js
 * (Link, usePathname, useRouter, useSearchParams) : les composants partagés n'ont pas changé.
 * Les liens passent par le routeur : préchargement au survol, transitions de page.
 */
import {
  type LinkComponentProps,
  Link as RouterLink,
  useLocation,
  useNavigate,
  useRouter as useTanstackRouter,
} from "@tanstack/react-router";
import { type ComponentProps, forwardRef } from "react";

/** « /app/reservations?onglet=a#x » → chemin, paramètres et ancre séparés. */
function splitHref(href: string) {
  const url = new URL(href, "http://horaya.local");
  return {
    to: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash ? url.hash.slice(1) : undefined,
  };
}

type LinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, replace, scroll: _scroll, ...rest },
  ref,
) {
  // Liens externes, mailto:, tel:, téléchargements : une simple balise <a>.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || rest.download !== undefined) {
    return <a ref={ref} href={href} {...rest} />;
  }
  const { to, search, hash } = splitHref(href);
  return (
    <RouterLink
      ref={ref}
      {...(rest as Omit<LinkComponentProps<"a">, "to">)}
      // Routes typées : les chemins viennent de chaînes construites dans les composants.
      to={to as never}
      search={search as never}
      hash={hash}
      replace={replace}
      preload={prefetch === false ? false : undefined}
    />
  );
});

export function usePathname() {
  return useLocation({ select: (location) => location.pathname });
}

export function useSearchParams() {
  const searchStr = useLocation({ select: (location) => location.searchStr });
  return new URLSearchParams(searchStr);
}

/** push / replace / refresh / back, comme le routeur de Next. */
export function useRouter() {
  const router = useTanstackRouter();
  const navigate = useNavigate();
  return {
    // Chemins construits à la main : pas de vérification de type des routes ici.
    push: (href: string) => navigate(splitHref(href) as never),
    replace: (href: string) => navigate({ ...splitHref(href), replace: true } as never),
    /** Recharge les données de la page (équivalent de router.refresh). */
    refresh: () => router.invalidate(),
    back: () => router.history.back(),
    prefetch: (href: string) => router.preloadRoute({ to: splitHref(href).to as never }),
  };
}
