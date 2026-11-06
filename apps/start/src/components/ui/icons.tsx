import type React from "react";

export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" className={className}>
      <path d="M1 7H14M9 2L14 7L9 12" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" className={className}>
      <path d="M15 7H2M7 2L2 7L7 12" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** `draw` : la coche se dessine à l'affichage (confirmations). */
export function Check({
  className,
  size = 12,
  draw = false,
}: {
  className?: string;
  size?: number;
  draw?: boolean;
}) {
  return (
    <svg
      width={size}
      height={(size * 10) / 12}
      viewBox="0 0 12 10"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M1 5L4.5 8.5L11 1.5"
        pathLength={1}
        className={draw ? "draw" : undefined}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Envelope({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 18) / 24}
      viewBox="0 0 24 18"
      aria-hidden="true"
      className={className}
    >
      <rect x="1" y="1" width="22" height="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M1 2L12 10L23 2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ChevronDown({ className }: { className?: string }) {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true" className={className}>
      <path d="M1 1.5L6 6.5L11 1.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.6 9.2C17.6 8.6 17.5 8 17.4 7.4H9V10.9H13.8C13.6 12 13 12.9 12 13.6V15.8H14.9C16.6 14.3 17.6 12 17.6 9.2Z"
        fill="#4285F4"
      />
      <path
        d="M9 18C11.4 18 13.5 17.2 14.9 15.8L12 13.6C11.2 14.1 10.2 14.4 9 14.4C6.7 14.4 4.7 12.8 4 10.7H1V13C2.5 15.9 5.5 18 9 18Z"
        fill="#34A853"
      />
      <path
        d="M4 10.7C3.8 10.2 3.7 9.6 3.7 9C3.7 8.4 3.8 7.8 4 7.3V5H1C0.4 6.2 0 7.6 0 9C0 10.4 0.4 11.8 1 13L4 10.7Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.6C10.3 3.6 11.5 4.1 12.4 5L15 2.4C13.5 1 11.4 0 9 0C5.5 0 2.5 2.1 1 5L4 7.3C4.7 5.2 6.7 3.6 9 3.6Z"
        fill="#EA4335"
      />
    </svg>
  );
}

/*
 * Icônes de l'admin : jeu Lucide des maquettes DA v4 (grille 24, trait 1,75, bouts arrondis),
 * couleur héritée du texte.
 */

interface IconProps {
  className?: string;
  size?: number;
}

function Svg({
  size = 18,
  viewBox = "0 0 24 24",
  className,
  children,
}: IconProps & { viewBox?: string; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </Svg>
);

export const CalendarIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

export const TicketIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </Svg>
);

export const ReceiptIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 12h5M16 9.5a4 4 0 1 0 0 5.2" />
  </Svg>
);

export const BoxIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </Svg>
);

export const UsersIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const SettingsIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 7h-9M14 17H5" />
    <circle cx="17" cy="17" r="3" />
    <circle cx="7" cy="7" r="3" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const BellIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);

/** Touche Entrée (corner-down-left). */
export const EnterIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 10 4 15l5 5M20 4v7a4 4 0 0 1-4 4H4" />
  </Svg>
);

export const PinIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </Svg>
);

export const ExternalIcon = (props: IconProps) => (
  <Svg {...props} viewBox="0 0 14 14">
    <path d="M4 2H12V10M12 2L2 12" strokeWidth="2" />
  </Svg>
);

export function PlusIcon({ className, size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className={className}>
      <path d="M7 1V13M1 7H13" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function CloseIcon({ className, size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className={className}>
      <path d="M2 2L12 12M12 2L2 12" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ChevronLeft({ className }: IconProps) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" className={className}>
      <path d="M8 1L2 7L8 13" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export function ChevronRight({ className }: IconProps) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" className={className}>
      <path d="M2 1L8 7L2 13" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export function KebabIcon({ className }: IconProps) {
  return (
    <svg width="16" height="4" viewBox="0 0 16 4" aria-hidden="true" className={className}>
      <circle cx="2" cy="2" r="1.6" fill="currentColor" />
      <circle cx="8" cy="2" r="1.6" fill="currentColor" />
      <circle cx="14" cy="2" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" className={className}>
      <path d="M0 1H20M0 7H20M0 13H20" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" className={className}>
      <path d="M7 1V11M3 7L7 11L11 7M1 15H13" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
