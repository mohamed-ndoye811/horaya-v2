/*
 * Silhouette du notch, en un seul tracé : raccord au cadre, flanc, coin du bas, et le miroir.
 * Replié (Paper « 0.1 · Notch · états ») : la courbe en S « C24 6 20 56 44 56 », coupée en deux
 * moitiés exactes (raccord jusqu'au point (22, 31), puis coin), sans flanc entre les deux.
 * Agrandi : raccord de 28 px qui finit à la verticale à 36 px, flanc droit, coin de 28 px.
 * `open` va de 0 à 1 ; entre les deux, le flanc part un peu incliné et se redresse, et les
 * tangentes restent alignées aux jonctions : la silhouette reste lisse à chaque image.
 */

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const round = (value: number) => Math.round(value * 100) / 100;

export const NOTCH_BAR_HEIGHT = 56;
/** Largeur des courbes de chaque côté : 44 px replié, 28 px agrandi. */
export const notchEdge = (open: number) => lerp(44, 28, open);

export function notchShape(width: number, height: number, open: number) {
  const e = open;
  // Inclinaison du flanc (dx par px de hauteur) : celle du S au point de coupe, puis droite.
  const tilt = 0.4 * (1 - e) ** 3;
  // Fin du raccord au cadre.
  const px = lerp(22, 28, e);
  const py = lerp(31, 36, e);
  const reach = lerp(12.5, 22, e);
  const c1 = [lerp(12, 22, e), 6];
  const c2 = [px - tilt * reach, py - reach];
  // Début du coin, au bas du flanc.
  const qy = Math.max(py, height - lerp(25, 28, e));
  const qx = px + tilt * (qy - py);
  const lead = lerp(12.5, 15.46, e);
  const c3 = [qx + tilt * lead, qy + lead];
  const ex = qx + lerp(22, 28, e);
  const c4 = [ex - lerp(12, 15.46, e), height];

  const n = round;
  const w = width;
  const d = [
    "M0 0 L0 6",
    `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(px)} ${n(py)}`,
    `L${n(qx)} ${n(qy)}`,
    `C${n(c3[0])} ${n(c3[1])} ${n(c4[0])} ${n(c4[1])} ${n(ex)} ${n(height)}`,
    `L${n(w - ex)} ${n(height)}`,
    `C${n(w - c4[0])} ${n(c4[1])} ${n(w - c3[0])} ${n(c3[1])} ${n(w - qx)} ${n(qy)}`,
    `L${n(w - px)} ${n(py)}`,
    `C${n(w - c2[0])} ${n(c2[1])} ${n(w - c1[0])} ${n(c1[1])} ${n(w)} 6`,
    `L${n(w)} 0 Z`,
  ].join(" ");
  // Retrait des flancs (pour découper le contenu) et rayon du coin.
  return { d, side: n(px), radius: n(lerp(0, 28, e)) };
}
