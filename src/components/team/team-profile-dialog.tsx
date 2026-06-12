"use client";

/**
 * Team member profile dialog (admin).
 *
 * Opened from the "View Profile" button on a team card. Shows the
 * member's details + account status, and lets an admin set/reset their
 * password so they can verify the member can log in with known
 * credentials and has the right access.
 *
 * The password is shown in plain text on screen (so the admin can copy
 * it to share); it's hashed server-side and never returned. Reset is
 * audit-logged in the API.
 */
import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  business: string | null;
  hasPassword?: boolean;
  createdAt: string;
}

interface Props {
  member: TeamMember;
  businessLabel: Record<string, string>;
  roleLabel: string;
  onClose: () => void;
  /** Called after a successful password set so the card can update its status. */
  onPasswordSet: (memberId: string) => void;
}

/** A readable-over-the-phone password (no 0/O, 1/l/I confusion). */
function suggestPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function TeamProfileDialog({
  member,
  businessLabel,
  roleLabel,
  onClose,
  onPasswordSet,
}: Props) {
  const [password, setPassword] = useState(() => suggestPassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const firstName = member.name.split(" ")[0] || member.name;

  async function setNewPassword() {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't update the password.");
      }
      setDone(true);
      onPasswordSet(member.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile summary */}
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{roleLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{member.email}</span>
            </div>
            {member.business && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {businessLabel[member.business] || member.business}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  member.hasPassword
                    ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                {member.hasPassword ? "Password set · can log in" : "No password yet"}
              </span>
            </div>
          </div>

          {/* Password reset */}
          {done ? (
            <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                Password updated
              </div>
              <p className="text-xs text-green-800 dark:text-green-300/90">
                Share this with {firstName} so they can sign in:
              </p>
              <code className="block rounded-lg bg-white px-3 py-2 font-mono text-sm text-foreground dark:bg-black/30">
                {password}
              </code>
              <p className="text-[11px] text-green-800/80 dark:text-green-300/70">
                To test access yourself: open a private/incognito window, go to
                the login page, and sign in as {member.email} with this
                password. Ask {firstName} to change it after their first login.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reset-pw" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Set / reset password
              </Label>
              <div className="flex gap-2">
                <Input
                  id="reset-pw"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPassword(suggestPassword())}
                  title="Generate a new password"
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sets a known password so you can confirm {firstName} can log in
                and has the right access. They can change it afterwards.
              </p>
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              )}
              <Button
                onClick={setNewPassword}
                disabled={saving}
                className="w-full rounded-xl"
              >
                {saving ? "Saving…" : "Set password"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
