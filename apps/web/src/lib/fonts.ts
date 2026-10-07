/** Police des titres choisie par l'espace (écran 24), appliquée à sa page publique. */
export const DISPLAY_FONT_CLASSES: Record<string, string> = {
  display: "font-headline uppercase",
  ui: "font-ui font-extrabold",
  mono: "font-mono font-bold",
};

export const displayFontClass = (font: string) =>
  DISPLAY_FONT_CLASSES[font] ?? DISPLAY_FONT_CLASSES.display;
