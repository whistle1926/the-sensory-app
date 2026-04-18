"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2, AlertCircle, User } from "lucide-react";
import { Toolbar, Panel } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Panel>
        <div className="ds-empty">Could not load profile.</div>
      </Panel>
    );
  }

  const joined = new Date(profile.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <Toolbar
        title="Your Profile"
        subtitle="Update your name and password. We'll never share your details."
      />

      {/* Profile summary KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ds-kpi">
          <div className="ds-kpi-head">
            <span className="ds-kpi-label">Name</span>
            <span className="ds-kpi-icon">
              <User className="h-4 w-4" />
            </span>
          </div>
          <span className="ds-kpi-value" style={{ fontSize: 18 }}>
            {profile.name}
          </span>
          <div className="ds-kpi-foot">
            <span>Display name</span>
          </div>
        </div>
        <div className="ds-kpi">
          <div className="ds-kpi-head">
            <span className="ds-kpi-label">Email</span>
          </div>
          <span
            className="ds-kpi-value ds-tabular"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            {profile.email}
          </span>
          <div className="ds-kpi-foot">
            <span>Used to sign in</span>
          </div>
        </div>
        <div className="ds-kpi">
          <div className="ds-kpi-head">
            <span className="ds-kpi-label">Joined</span>
          </div>
          <span className="ds-kpi-value" style={{ fontSize: 18 }}>
            {joined}
          </span>
          <div className="ds-kpi-foot">
            <span>Member since</span>
          </div>
        </div>
      </div>

      {/* Update name */}
      <Panel
        title="Your name"
        subtitle="This is how your name appears in emails and across the portal."
        padded
      >
        <form onSubmit={saveName} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              disabled={savingName}
            />
          </div>
          {nameMsg && (
            <p
              className={`flex items-center gap-1.5 text-sm ${
                nameMsg.tone === "ok" ? "text-green-700" : "text-red-600"
              }`}
            >
              {nameMsg.tone === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {nameMsg.text}
            </p>
          )}
          <Button
            type="submit"
            disabled={savingName || name.trim() === (profile.name || "")}
            className="rounded-xl"
          >
            {savingName ? "Saving…" : "Save name"}
          </Button>
        </form>
      </Panel>

      {/* Change password */}
      <Panel
        title="Change password"
        subtitle="Choose something memorable but hard to guess. At least 8 characters."
        padded
      >
        <form onSubmit={savePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              disabled={savingPw}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={savingPw}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={savingPw}
              required
            />
          </div>
          {pwMsg && (
            <p
              className={`flex items-center gap-1.5 text-sm ${
                pwMsg.tone === "ok" ? "text-green-700" : "text-red-600"
              }`}
            >
              {pwMsg.tone === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {pwMsg.text}
            </p>
          )}
          <Button type="submit" disabled={savingPw} className="rounded-xl">
            {savingPw ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
