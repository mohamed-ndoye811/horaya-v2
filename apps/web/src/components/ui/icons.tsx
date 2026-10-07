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

export function Check({ className, size = 12 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 10) / 12}
      viewBox="0 0 12 10"
      aria-hidden="true"
      className={className}
    >
      <path d="M1 5L4.5 8.5L11 1.5" fill="none" stroke="currentColor" strokeWidth="2" />
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

/* Icônes de l'admin (traits 1,6 px, couleur héritée du texte). */

interface IconProps {
  className?: string;
  size?: number;
}

function Svg({
  size = 18,
  viewBox = "0 0 18 18",
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
      strokeWidth="1.6"
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="2" y="2" width="6" height="6" />
    <rect x="10" y="2" width="6" height="6" />
    <rect x="2" y="10" width="6" height="6" />
    <rect x="10" y="10" width="6" height="6" />
  </Svg>
);

export const CalendarIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="2" y="3" width="14" height="13" />
    <path d="M2 7H16M6 1V5M12 1V5" />
  </Svg>
);

export const TicketIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 4H16V7C14.9 7 14 7.9 14 9C14 10.1 14.9 11 16 11V14H2V11C3.1 11 4 10.1 4 9C4 7.9 3.1 7 2 7V4Z" />
  </Svg>
);

export const ReceiptIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="2" width="12" height="14" />
    <path d="M6 6H12M6 9H12M6 12H10" />
  </Svg>
);

export const BoxIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 5L9 2L16 5V13L9 16L2 13V5Z" />
    <path d="M2 5L9 8L16 5M9 8V16" />
  </Svg>
);

export const UserIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="6" r="3.5" />
    <path d="M2.5 16C2.5 12.4 5.4 10.5 9 10.5C12.6 10.5 15.5 12.4 15.5 16" />
  </Svg>
);

export const SettingsIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="9" r="2.5" />
    <path d="M9 1.5V4M9 14V16.5M1.5 9H4M14 9H16.5M3.7 3.7L5.5 5.5M12.5 12.5L14.3 14.3M3.7 14.3L5.5 12.5M12.5 5.5L14.3 3.7" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props} className={props.className}>
    <circle cx="8" cy="8" r="5.5" strokeWidth="1.8" />
    <path d="M12 12L16 16" strokeWidth="1.8" />
  </Svg>
);

export const PinIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 16C9 16 14 11.5 14 7.5C14 4.7 11.8 2.5 9 2.5C6.2 2.5 4 4.7 4 7.5C4 11.5 9 16 9 16Z" />
    <circle cx="9" cy="7.5" r="1.8" />
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
