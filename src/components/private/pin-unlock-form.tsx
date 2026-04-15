"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PinUnlockForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/private/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Incorrect PIN" }));
        setError(data.error || "Incorrect PIN");
        setLoading(false);
        return;
      }
      window.location.href = "/private";
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-950/30">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="h-12 rounded-xl text-center text-lg tracking-widest"
        />
      </div>
      <Button
        type="submit"
        disabled={loading || pin.length === 0}
        className="h-11 w-full rounded-xl"
      >
        {loading ? "Unlocking…" : "Unlock"}
      </Button>
    </form>
  );
}
