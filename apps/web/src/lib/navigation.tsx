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

/** Lien du routeur ; sur la même page (filtre, onglet en paramètre), le défilement reste en place. */
const SameOrNewPageLink = forwardRef<HTMLAnchorElement, LinkComponentProps<"a">>(
  function SameOrNewPageLink(props, ref) {
    const pathname = useLocation({ select: (location) => location.pathname });
    return <RouterLink ref={ref} resetScroll={props.to !== pathname} {...props} />;
  },
);

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
  // Liens externes, mailto:, tel:, ancres de la page, téléchargements et routes serveur (exports, modèles :
  // `prefetch={false}` dans l'ancienne app) : une simple balise <a>, hors du routeur.
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("#") ||
    rest.download !== undefined ||
    prefetch === false
  ) {
    return <a ref={ref} href={href} {...rest} />;
  }
  const { to, search, hash } = splitHref(href);
  return (
    <SameOrNewPageLink
      ref={ref}
      {...(rest as Omit<LinkComponentProps<"a">, "to">)}
      // Routes typées : les chemins viennent de chaînes construites dans les composants.
      to={to as never}
      search={search as never}
      hash={hash}
      replace={replace}
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
  const withScroll = <T extends { to: string }>(target: T) => ({
    ...target,
    resetScroll: target.to !== router.state.location.pathname,
  });
  return {
    // Chemins construits à la main : pas de vérification de type des routes ici. Sur la même
    // page (filtres, recherche), le défilement reste en place.
    push: (href: string) => navigate(withScroll(splitHref(href)) as never),
    replace: (href: string) => navigate({ ...withScroll(splitHref(href)), replace: true } as never),
    /** Recharge les données de la page (équivalent de router.refresh). */
    refresh: () => router.invalidate(),
    back: () => router.history.back(),
    prefetch: (href: string) => router.preloadRoute({ to: splitHref(href).to as never }),
  };
}
