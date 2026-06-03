import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FBF8F3]">
      {/* Slim top bar — Sensory Submarine wordmark links home so
          someone who clicks the logo on /login can get back to the
          marketing page without using the browser back button. */}
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
