import { createFileRoute } from "@tanstack/react-router";
import { FILE_KEY } from "@/lib/files";
import { readFile } from "@/server/storage";

/**
 * Images des espaces, lues dans le bucket privé. Une clé ne sert qu'une fois (identifiant
 * unique, nouvelle clé à chaque remplacement) : le navigateur et Cloudflare la gardent un an.
 */
export const Route = createFileRoute("/fichiers/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = params._splat ?? "";
        const stored = FILE_KEY.test(key) ? await readFile(key) : null;
        if (!stored?.ok || !stored.body) return new Response("Introuvable", { status: 404 });
        return new Response(stored.body, {
          headers: {
            "Content-Type": stored.headers.get("Content-Type") ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            // Un PDF s'ouvre dans le navigateur, jamais comme une page de l'app.
            ...(key.endsWith(".pdf") && {
              "Content-Disposition": "inline",
              "Content-Security-Policy": "sandbox",
            }),
          },
        });
      },
    },
  },
});
