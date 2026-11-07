/** Protocole « store » de Sentry, parlé par GlitchTip (voir server/errors.ts). */

/** DSN « https://<clé>@<hôte>/<projet> » → adresse d'envoi et clé. */
export function parseDsn(dsn: string | undefined) {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\//, "");
    if (!url.username || !project) return null;
    return { key: url.username, endpoint: `${url.origin}/api/${project}/store/` };
  } catch {
    return null;
  }
}

/** Pile V8 (« at fn (fichier:ligne:colonne) ») → cadres Sentry, du plus ancien au plus récent. */
export function framesOf(stack: string | undefined) {
  return (stack ?? "")
    .split("\n")
    .map((line) => line.match(/^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, fn, file, line, column]) => ({
      function: fn ?? "?",
      filename: file,
      lineno: Number(line),
      colno: Number(column),
      in_app: !file?.includes("node_modules"),
    }))
    .reverse();
}
