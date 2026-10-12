import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { authCookiePrefix } from "@/server/poste";

/**
 * Contrôle optimiste : sans cookie de session, inutile de rendre l'admin.
 * La vraie vérification (session valide en base) se fait dans chaque page et action.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request, { cookiePrefix: authCookiePrefix(process.env.POSTE) })) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
