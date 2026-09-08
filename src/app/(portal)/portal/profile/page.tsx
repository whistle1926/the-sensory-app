"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2, AlertCircle, User, Mail, Calendar } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const FIELD =
  "w-full rounded-full border-[3px] border-[#D9D2C4] bg-[#FFFCF6] px-[18px] py-3.5 text-base font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#12235B] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";
const LABEL = "mb-2 block text-sm font-extrabold";
const PRIMARY_BTN =
  "sub-edge sub-press inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50";

function Notice({ tone, text }: { tone: "ok" | "err"; text: string }) {
  const ok = tone === "ok";
  return (
    <p
      className={`flex items-center gap-2 rounded-[18px] border-2 px-4 py-3.5 text-sm font-bold ${
        ok
          ? "border-[#C2E7E3] bg-[#E7F6F4] text-[#12235B]"
          : "border-[#FBC7D7] bg-[#FFE7EE] text-[#B81243]"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#17B0A7]" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {text}
    </p>
  );
}

/**
 * Portal — self-serve profile page. CLIENT users can update their name
 * and change their password here. Email is read-only.
 */
export default function PortalProfilePage() {
  const { update: refreshSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<
    { tone: "ok" | "err"; text: string } | null
  >(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<
    { tone: "ok" | "err"; text: string } | null
  >(null);

  useEffect(() => {
    fetch("/api/portal/profile")
      .then((r) => r.json())
      .then((data: Profile) => {
        setProfile(data);
        setName(data.name || "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameMsg({
          tone: "err",
          text: data.error || "Could not update",
        });
      } else {
        setProfile(data);
        setNameMsg({ tone: "ok", text: "Saved." });
        // Refresh NextAuth session so the avatar picks up the new name.
        await refreshSession();
      }
    } catch {
      setNameMsg({ tone: "err", text: "Network error." });
    }
    setSavingName(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg({ tone: "err", text: "New passwords don't match." });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({
        tone: "err",
        text: "Password must be at least 8 characters.",
      });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({
          tone: "err",
          text: data.error || "Could not update password",
        });
      } else {
        setPwMsg({ tone: "ok", text: "Password updated." });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      setPwMsg({ tone: "err", text: "Network error." });
    }
    setSavingPw(false);
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E71D57]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="sub-edge rounded-[26px] bg-white p-7 text-center text-[15px] font-semibold text-[#6B7794]">
        Could not load profile.
      </div>
    );
  }

  const joined = new Date(profile.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* ── Page head ──────────────────────────────────────────────── */}
      <div>
        <h1 className="sub-display text-[34px] tracking-[-1px] sm:text-[44px]">
          Your Profile
        </h1>
        <p className="mt-1 text-base font-semibold text-[#6B7794]">
          Update your name and password. We&apos;ll never share your details.
        </p>
      </div>

      {/* ── Profile summary tiles ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sub-edge flex items-start gap-3.5 rounded-[26px] bg-white p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border-[3px] border-[#12235B] bg-[#FFC93C]">
            <User className="h-5 w-5 text-[#12235B]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[1px] text-[#6B7794]">
              Name
            </p>
            <p className="sub-display truncate text-xl">{profile.name}</p>
            <p className="text-[13px] font-semibold text-[#6B7794]">
              Display name
            </p>
          </div>
        </div>
        <div className="sub-edge flex items-start gap-3.5 rounded-[26px] bg-white p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border-[3px] border-[#12235B] bg-[#17B0A7]">
            <Mail className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[1px] text-[#6B7794]">
              Email
            </p>
            <p className="truncate text-[15px] font-bold">{profile.email}</p>
            <p className="text-[13px] font-semibold text-[#6B7794]">
              Used to sign in
            </p>
          </div>
        </div>
        <div className="sub-edge flex items-start gap-3.5 rounded-[26px] bg-white p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border-[3px] border-[#12235B] bg-[#E71D57]">
            <Calendar className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[1px] text-[#6B7794]">
              Joined
            </p>
            <p className="sub-display text-xl">{joined}</p>
            <p className="text-[13px] font-semibold text-[#6B7794]">
              Member since
            </p>
          </div>
        </div>
      </div>

      {/* ── Update name ───────────────────────────────────────────── */}
      <section className="sub-edge rounded-[26px] bg-white p-6 sm:p-7">
        <h2 className="sub-display text-2xl">Your name</h2>
        <p className="mb-5 mt-1 text-[15px] font-semibold text-[#6B7794]">
          This is how your name appears in emails and across the portal.
        </p>
        <form onSubmit={saveName} className="space-y-5">
          <div>
            <label htmlFor="profile-name" className={LABEL}>
              Full name
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              disabled={savingName}
              className={FIELD}
            />
          </div>
          {nameMsg && <Notice tone={nameMsg.tone} text={nameMsg.text} />}
          <button
            type="submit"
            disabled={savingName || name.trim() === (profile.name || "")}
            className={PRIMARY_BTN}
            style={{ background: "var(--sub-pink)" }}
          >
            {savingName ? "Saving…" : "Save name"}
          </button>
        </form>
      </section>

      {/* ── Change password ───────────────────────────────────────── */}
      <section className="sub-edge rounded-[26px] bg-white p-6 sm:p-7">
        <h2 className="sub-display text-2xl">Change password</h2>
        <p className="mb-5 mt-1 text-[15px] font-semibold text-[#6B7794]">
          Choose something memorable but hard to guess. At least 8 characters.
        </p>
        <form onSubmit={savePassword} className="space-y-5">
          <div>
            <label htmlFor="current-password" className={LABEL}>
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              disabled={savingPw}
              required
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="new-password" className={LABEL}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={savingPw}
              required
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className={LABEL}>
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={savingPw}
              required
              className={FIELD}
            />
          </div>
          {pwMsg && <Notice tone={pwMsg.tone} text={pwMsg.text} />}
          <button
            type="submit"
            disabled={savingPw}
            className={PRIMARY_BTN}
            style={{ background: "var(--sub-pink)" }}
          >
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}
