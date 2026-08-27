"use client";

import { useState } from "react";
import { Check, Download, Loader2, Mail } from "lucide-react";

interface Resource {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
}

/**
 * A card per download, with the email form opening in place.
 *
 * The form only appears once someone has chosen something — asking for an
 * address before they know what they're getting is how you collect nothing.
 */
export function ResourceList({ resources }: { resources: Resource[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2">
      {resources.map((r) => (
        <article
          key={r.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]"
        >
          {r.thumbnailUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={r.thumbnailUrl}
              alt=""
              className="h-44 w-full border-b border-border object-cover"
            />
          )}
          <div className="flex flex-1 flex-col p-5">
            <h2 className="text-lg font-black leading-snug">{r.title}</h2>
            {r.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {r.description}
              </p>
            )}

            <div className="mt-4">
              {sentId === r.id ? (
                <p className="flex items-start gap-2 rounded-xl border-2 border-primary/30 bg-primary/[0.05] p-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <strong>On its way.</strong> Check your inbox — if it
                    isn&apos;t there in a minute or two, have a look in your
                    junk folder.
                  </span>
                </p>
              ) : openId === r.id ? (
                <RequestForm resource={r} onSent={() => setSentId(r.id)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  Get this free
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RequestForm({
  resource,
  onSent,
}: {
  resource: Resource;
  onSent: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const field =
    "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";

  async function submit() {
    setError("");
    if (!email.trim()) {
      setError("We need an email address to send it to.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/resources/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id,
          name,
          email,
          website,
          marketingConsent: consent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      onSent();
    } catch {
      setError("Couldn't reach us just then. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <input
        className={field}
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={field}
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {/* Hidden from people, irresistible to bots. */}
      <input
        aria-hidden
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
      />

      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Email me occasionally about new resources and courses. Entirely
          optional — you&apos;ll get this download either way.
        </span>
      </label>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Send it to me
      </button>
    </div>
  );
}
