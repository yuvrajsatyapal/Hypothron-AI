import Link from "next/link";
export function Brand() {
  return (
    <Link
      href="/"
      prefetch={false}
      aria-label="Hypothron AI home"
      className="inline-flex min-h-11 shrink-0 items-center gap-2.5 text-on-surface"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-teal text-white">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 3h10M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3M7 15h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="11" cy="17" r="1" fill="currentColor" />
        </svg>
      </span>
      <span>
        <span className="block text-sm font-extrabold tracking-tight">
          HYPOTHRON
        </span>
        <span className="block font-mono text-[9px] tracking-[.16em] text-on-surface-muted">
          SCIENTIFIC AI
        </span>
      </span>
    </Link>
  );
}
