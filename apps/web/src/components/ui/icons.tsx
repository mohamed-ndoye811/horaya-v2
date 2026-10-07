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
