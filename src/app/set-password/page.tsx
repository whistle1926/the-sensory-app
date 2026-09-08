"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SubmarineHeader } from "@/components/storefront/submarine-header";

const FIELD =
  "w-full rounded-full border-[3px] border-[#D9D2C4] bg-[#FFFCF6] px-[18px] py-4 text-base font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#12235B] focus:bg-white";

function SetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing setup link token");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Something went wrong" }));
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        // Carry the destination through the sign-in so a buyer lands on the
        // course they just paid for, not a list.
        const raw = new URLSearchParams(window.location.search).get("next") ?? "";
        const next = /^\/[^/\\]/.test(raw) ? raw : "";
        window.location.href = next
          ? `/login?fromSetup=1&next=${encodeURIComponent(next)}`
          : "/login?fromSetup=1";
      }, 1200);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="sub-edge-xl w-full max-w-[470px] rounded-[34px] bg-white p-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#17B0A7]" />
        <h1 className="sub-display mt-4 text-[30px]">Password set</h1>
        <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
          Redirecting to login…
        </p>
      </div>
    );
  }

  return (
    <div className="sub-edge-xl w-full max-w-[470px] rounded-[34px] bg-white px-7 pb-8 pt-9 sm:px-9 sm:pt-10">
      <h1 className="sub-display text-[34px] tracking-[-1px] sm:text-[42px]">
        Set your password
      </h1>
      <p className="mt-2 text-base font-semibold text-[#5A6785]">
        Choose a password for your account.
      </p>

      {error && (
        <p className="mt-6 rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3.5 text-sm font-bold text-[#B81243]">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6">
        <label htmlFor="password" className="mb-2 block text-sm font-extrabold">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={FIELD}
        />

        <label
          htmlFor="confirm"
          className="mb-2 mt-[18px] block text-sm font-extrabold"
        >
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          className={FIELD}
        />

        <button
          type="submit"
          disabled={loading}
          className="sub-display sub-edge-lg sub-press mt-6 w-full rounded-full px-6 py-4 text-xl text-white disabled:opacity-60"
          style={{ background: "var(--sub-pink)" }}
        >
          {loading ? "Setting password..." : "Set password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-[#6B7794]">
        Already have a password?{" "}
        <Link
          href="/login"
          className="font-extrabold text-[#E71D57] hover:text-[#B81243]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />
      <main className="relative flex items-center justify-center overflow-hidden px-5 py-12 sm:px-14 sm:py-16">
        <div className="sub-dots pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -left-[100px] -top-[120px] h-[380px] w-[380px] rounded-full bg-[#FFE9A8]"
          aria-hidden
        />
        <div className="relative flex w-full justify-center">
          <Suspense
            fallback={
              <div className="flex w-full justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#6B7794]" />
              </div>
            }
          >
            <SetPasswordInner />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
