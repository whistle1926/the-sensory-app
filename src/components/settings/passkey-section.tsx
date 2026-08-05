"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Loader2, ShieldCheck, Trash2 } from "lucide-react";

interface Passkey {
  id: string;
  label: string | null;
  deviceType: string;
  backedUp: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Register and manage your own passkeys.
 *
 * Only ever your own — a passkey is proof of a device you hold, so nobody
 * else, admin or not, can add one for you.
 */
export function PasskeySection() {
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/passkey");
      if (r.ok) {
        const j = (await r.json()) as { passkeys?: Passkey[] };
        setKeys(j.passkeys ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && !!window.PublicKeyCredential,
    );
    load();
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch("/api/passkey/register");
      if (!optRes.ok) throw new Error("Couldn't start.");
      const options = await optRes.json();
      const { startRegistration } = await import("@simplewebauthn/browser");
      const answer = await startRegistration(options);

      const label =
        typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
          ? "This Mac"
          : typeof navigator !== "undefined" && /iPhone|iPad/i.test(navigator.userAgent)
            ? "This iPhone or iPad"
            : "This device";

      const res = await fetch("/api/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: answer, label }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Couldn't save that passkey.");
      await load();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Couldn't add a passkey.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this passkey? You can add it again at any time.")) return;
    setBusy(true);
    try {
      await fetch(`/api/passkey/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Fingerprint className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Passkeys — sign in with your face or fingerprint</h2>
          <p className="text-xs text-muted-foreground">
            No password to type or remember. Uses Touch ID, Face ID or Windows
            Hello on the device you&apos;re on.
          </p>
        </div>
      </div>

      {!supported && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          This browser doesn&apos;t support passkeys. Try Safari or Chrome on a
          recent phone or computer.
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {keys.length > 0 && (
            <ul className="mb-4 space-y-2">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      {k.label ?? "Passkey"}
                      {k.backedUp && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          synced
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Added {new Date(k.createdAt).toLocaleDateString("en-GB")}
                      {k.lastUsedAt
                        ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString("en-GB")}`
                        : " · not used yet"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(k.id)}
                    disabled={busy}
                    aria-label="Remove this passkey"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={add}
            disabled={busy || !supported}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
            {keys.length ? "Add another passkey" : "Set up a passkey"}
          </button>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Why this is safer</p>
            <p className="mt-1">
              Nothing secret is ever sent or stored — your device keeps the key
              and only proves it has it. There is no password to guess or
              overhear, and a fake login page can&apos;t use it, because the
              passkey only works on the real site.
            </p>
            <p className="mt-2">
              Add one on each device you use. Your email and password still work
              as a backup.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
