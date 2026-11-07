import { useEffect, useSyncExternalStore } from "react";

/**
 * Messages éphémères de l'admin : la languette sous le notch (grand écran) ou au-dessus de la
 * pilule (mobile). Une seule à la fois ; les suivantes attendent leur tour. La minuterie est ici,
 * pas dans l'affichage : le notch et la pilule sont montés tous les deux (un seul est visible).
 */
export type ToastTone = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Lien ouvert au clic (notification). */
  href?: string;
}

/** Durée d'affichage ; après un survol, un peu moins pour finir de lire. */
const SHOW_MS = 4500;
const AFTER_HOVER_MS = 2000;
/** Au-delà, les plus anciens messages en attente sont oubliés. */
const MAX_QUEUE = 4;

let queue: Toast[] = [];
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function schedule(ms: number) {
  clearTimeout(timer);
  const head = queue[0];
  if (head) timer = setTimeout(() => dismissToast(head.id), ms);
}

/** Affiche un message (confirmation par défaut). */
export function toast(message: string, options: { tone?: ToastTone; href?: string } = {}) {
  const wasEmpty = queue.length === 0;
  queue = [
    ...queue,
    { id: nextId++, tone: options.tone ?? "success", message, href: options.href },
  ];
  if (queue.length > MAX_QUEUE) queue = [queue[0] as Toast, ...queue.slice(-(MAX_QUEUE - 1))];
  if (wasEmpty) schedule(SHOW_MS);
  emit();
}

export function dismissToast(id: number) {
  if (queue[0]?.id !== id) return;
  queue = queue.slice(1);
  schedule(SHOW_MS);
  emit();
}

/** Survol ou focus : le message reste tant qu'on le lit. */
export function holdToast(held: boolean) {
  if (held) clearTimeout(timer);
  else schedule(AFTER_HOVER_MS);
}

/** Le message affiché, ou null (hors de React). */
export const currentToast = () => queue[0] ?? null;

/** Le message affiché, ou null. */
export function useToast(): Toast | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    currentToast,
    () => null,
  );
}

/** Formulaire de l'app : sa confirmation (`state.success`) part dans la languette. */
export function useSuccessToast(state: { success?: string | null }) {
  useEffect(() => {
    if (state.success) toast(state.success);
  }, [state]);
}
