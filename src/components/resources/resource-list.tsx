"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

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

  // The three accents take turns so a row of cards isn't all one colour.
  const ACCENTS = [
    { shadow: "#FFC93C", stripe: "#FFE9A8" },
    { shadow: "#E71D57", stripe: "#FFE1EA" },
    { shadow: "#17B0A7", stripe: "#D5F0ED" },
  ];

  return (
    <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((r, i) => {
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <article
            key={r.id}
            className="rounded-[28px] border-[3px] border-[#12235B] bg-white p-3.5 pb-6"
            style={{ boxShadow: `6px 6px 0 ${accent.shadow}` }}
          >
            <div
              className="grid h-[170px] place-items-center overflow-hidden rounded-[18px]"
              style={{
                background: `repeating-linear-gradient(135deg, ${accent.stripe} 0 10px, #FFF8EC 10px 20px)`,
              }}
            >
              {r.thumbnailUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="px-2">
              <h2 className="sub-display mb-1 mt-4 text-[22px] leading-tight">
                {r.title}
              </h2>
              {r.description && (
                <p className="text-[15px] font-semibold leading-relaxed text-[#6B7794]">
                  {r.description}
                </p>
              )}

              <div className="mt-4">
                {sentId === r.id ? (
                  <p className="flex items-start gap-2.5 rounded-[18px] border-2 border-[#A9DCD7] bg-[#E7F6F4] px-4 py-3 text-sm font-bold text-[#0E6F68]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      On its way — check your inbox, and your junk folder if
                      it&apos;s shy.
                    </span>
                  </p>
                ) : openId === r.id ? (
                  <RequestForm resource={r} onSent={() => setSentId(r.id)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    className="w-full rounded-full bg-[#12235B] px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-[#E71D57]"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
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
    "w-full rounded-full border-[3px] border-[#D9D2C4] bg-[#FFFCF6] px-4 py-2.5 text-[15px] font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#12235B] focus:bg-white";

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

      <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold leading-relaxed text-[#6B7794]">
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
        <p className="rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3 text-sm font-bold text-[#B81243]">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#12235B] px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-[#E71D57] disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Send it to me
      </button>
    </div>
  );
}
