import { type CSSProperties, Fragment, type ReactNode } from "react";

/** Rang d'un élément dans une arrivée en cascade (`reveal`, 60 ms par rang). */
export const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

/**
 * Titre qui se lève mot par mot (60 ms d'écart). CSS seul : marche sans JavaScript et le
 * texte reste entier dans le DOM. Un titre qui n'est pas du texte simple est rendu tel quel.
 */
export function WordsReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  if (typeof children !== "string") return children;
  // Vraies espaces entre les mots (copier-coller, recherche) : hors des blocs qui montent.
  return children.split(" ").map((word, index, words) => (
    <Fragment
      // biome-ignore lint/suspicious/noArrayIndexKey: les mots d'un titre fixe ne bougent pas.
      key={index}
    >
      <span className="reveal-word" style={stagger(delay + index)}>
        {word}
      </span>
      {index < words.length - 1 ? " " : null}
    </Fragment>
  ));
}
