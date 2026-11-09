import { type RefObject, useEffect } from "react";

/**
 * Couleur de la barre du navigateur (`theme-color`, que Safari et Yab reprennent) : celle du cadre
 * sur grand écran, pour que le notch pende du haut de la fenêtre sans liseré ; celle de la page
 * sur mobile, où il n'y a pas de cadre.
 */
export function useFrameThemeColor(frame: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
    }
    const tag = meta;
    const wide = window.matchMedia("(min-width: 64rem)");
    const apply = () => {
      const color = getComputedStyle(element).backgroundColor;
      tag.content =
        color === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.body).backgroundColor : color;
    };
    apply();
    wide.addEventListener("change", apply);
    return () => wide.removeEventListener("change", apply);
  }, [frame]);
}
