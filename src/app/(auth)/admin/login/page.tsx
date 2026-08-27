"use client";

import { useState } from "react";
import { signIn, getSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
      if (result?.ok) {
        const session = await getSession();
        const role = session?.user?.role;
        if (role === "CLIENT") {
          await signOut({ redirect: false });
          setError("This account is a parent account. Please use the parent login.");
          setLoading(false);
          return;
        }
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
              <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
              <path d="M4 13h7v7h-7V4Z" fill="white" opacity="0.6" />
              <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your admin account</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Enter your password"
                className="h-11 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary/80 transition-colors"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}
