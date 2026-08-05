"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, ShieldCheck } from "lucide-react";

/**
 * Your own quick sign-in passcode.
 *
 * Only ever the signed-in person's own — an admin can reset someone's
 * password as a support action, but a passcode is a personal shortcut and
 * should only be chosen by its owner.
 */
export function PasscodeSection() {
  const [state, setState] = useState<{
    hasPasscode: boolean;
    deviceTrusted: boolean;
    trustedDevices: number;
  } | null>(null);
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/passcode");
      if (r.ok) setState(await r.json());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setError(null);
    if (code !== confirm) {
      setError("The two codes don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't save that.");
      setCode("");
      setConfirm("");
      setDone(true);
      setTimeout(() => setDone(false), 4000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (
      !confirm2(
        "Turn off your passcode? You'll sign in with your email and password from now on.",
      )
    )
      return;
    setBusy(true);
    try {
      await fetch("/api/passcode", { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  // Named to avoid shadowing the `confirm` state above.
  function confirm2(msg: string) {
    return window.confirm(msg);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Quick sign-in passcode</h2>
          <p className="text-xs text-muted-foreground">
            Sign in with 6 digits instead of your full password, on the
            computers and phones you already use.
          </p>
        </div>
      </div>

      {state?.hasPasscode && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-green-500/30 bg-green-50 p-3 text-sm dark:bg-green-950/20">
          <ShieldCheck className="h-4 w-4 text-green-700 dark:text-green-400" />
          <span className="font-semibold text-green-900 dark:text-green-300">
            Passcode is on
          </span>
          <span className="text-green-900/70 dark:text-green-200/70">
            · {state.trustedDevices} remembered{" "}
            {state.trustedDevices === 1 ? "device" : "devices"}
            {state.deviceTrusted ? " · including this one" : ""}
          </span>
          <button
            type="button"
            onClick={turnOff}
            disabled={busy}
            className="ml-auto rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            Turn off
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="pc1">
            {state?.hasPasscode ? "New passcode" : "Choose a passcode"}
          </label>
          <input
            id="pc1"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="pc2">
            Type it again
          </label>
          <input
            id="pc2"
            inputMode="numeric"
            maxLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-green-50 p-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
          <Check className="h-4 w-4" />
          Saved. Next time you open the portal on this device, just type your
          passcode.
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy || code.length !== 6 || confirm.length !== 6}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {state?.hasPasscode ? "Change passcode" : "Turn on passcode"}
      </button>

      <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">How it keeps things safe</p>
        <p className="mt-1">
          The passcode only works on a device where you&apos;ve already signed
          in with your full password, so it&apos;s no use to anyone on another
          computer. Five wrong tries and that device asks for the full password
          again. Devices are forgotten after 30 days.
        </p>
        <p className="mt-2">
          Don&apos;t use a birthday, and don&apos;t use the same code as your
          phone unlock.
        </p>
      </div>
    </div>
  );
}
