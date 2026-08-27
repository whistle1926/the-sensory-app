import Link from "next/link";

/**
 * The plain auth chrome — slim wordmark bar, content centred.
 *
 * This used to be the (auth) layout itself. The sign-in page now brings
 * its own full-bleed design, so the chrome moved here and the pages that
 * still want it (register, staff login) opt in instead of inheriting it.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FBF8F3]">
      <header className="px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground hover:text-primary"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
              <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
              <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
              <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
            </svg>
          </span>
          The Sensory Submarine
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
        {children}
      </div>
    </div>
  );
}
