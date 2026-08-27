"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * "Send me everything" — one address, every sheet.
 *
 * Consent is a separate tick, never a condition of the download: under UK
 * GDPR the two can't be bundled, so the files go either way.
 */
export function BundleSignup({ count }: { count: number }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!email.trim()) {
      setError("We need an email address to send them to.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/resources/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, website, marketingConsent: consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't reach us just then. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[30px] border-[3px] border-[#0A1740] bg-[#12235B] p-7 shadow-[8px_8px_0_#E71D57] sm:p-8">
      <p className="sub-display text-[26px] text-white">Get the whole bundle</p>
      <p className="mt-2 text-[15px] font-semibold text-[#C6D0EA]">
        One email, every sheet below{count > 0 ? ` — all ${count} of them` : ""},
        plus new ones as they land.
      </p>

      {sent ? (
        <p className="mt-5 flex items-start gap-3 rounded-[18px] border-2 border-[#A9DCD7] bg-[#E7F6F4] px-4 py-3.5 text-sm font-bold text-[#0E6F68]">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            On its way. If it isn&apos;t in your inbox in a minute or two, have
            a look in your junk folder.
          </span>
        </p>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-5 w-full rounded-full border-[3px] border-[#0A1740] bg-white px-[18px] py-3.5 text-base font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#FFC93C]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="mt-3 w-full rounded-full border-[3px] border-[#0A1740] bg-white px-[18px] py-3.5 text-base font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#FFC93C]"
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

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] font-semibold leading-relaxed text-[#C6D0EA]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Email me occasionally about new resources and courses. Entirely
              optional — you&apos;ll get the sheets either way.
            </span>
          </label>

          {error && (
            <p className="mt-3 rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3 text-sm font-bold text-[#B81243]">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="sub-display sub-press mt-3 flex w-full items-center justify-center gap-2 rounded-full border-[3px] border-[#0A1740] bg-[#FFC93C] px-6 py-3.5 text-[18px] text-[#12235B] shadow-[4px_4px_0_#0A1740] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Send me the bundle
          </button>
          <p className="mt-3 text-center text-[13px] font-semibold text-[#8DA0D0]">
            No spam. Unsubscribe any time.
          </p>
        </>
      )}
    </div>
  );
}
