"use client";

/**
 * Add Parent / Carer dialog — staff-facing form for creating a new
 * portal account on behalf of a family. Used in the Toolbar slot on
 * /website-users. Posts to /api/users with role="CLIENT".
 *
 * Two flows for the password:
 *   - Generate one — server-side bcrypt hash; staff can copy and
 *     share, then ask the parent to reset it.
 *   - Set one manually — when the parent is sitting next to the OT
 *     and wants to choose their own.
 *
 * On success we router.refresh() so the new parent appears in the
 * table without a full reload. No redirect — the dialog just closes.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Build a random 12-char password the OT can share with the parent. */
function suggestPassword(): string {
  // Avoid easily-confused characters (0/O, 1/l/I) so the OT can read
  // it aloud over the phone without painful spelling-correction.
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function AddParentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => suggestPassword());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPassword(suggestPassword());
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: "CLIENT",
        }),
      });
      if (res.status === 409) {
        setError("An account with that email already exists.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(
          typeof data.error === "string"
            ? data.error
            : "Couldn't create the account. Please try again.",
        );
        return;
      }
      // Success — wipe the form, close the dialog, refresh so the new
      // row appears in the parents table.
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Add parent / carer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a parent or carer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ap-name">Full name</Label>
            <Input
              id="ap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-email">Email</Label>
            <Input
              id="ap-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              placeholder="parent@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-password">Temporary password</Label>
            <div className="flex gap-2">
              <Input
                id="ap-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="off"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(suggestPassword())}
                title="Generate a new random password"
                className="shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Share this with the parent so they can sign in — ask them to
              change it after their first login.
            </p>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create parent / carer account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
