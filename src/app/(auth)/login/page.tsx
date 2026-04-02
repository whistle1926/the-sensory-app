"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
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
      } else if (result?.ok) {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[oklch(0.637_0.237_25.331)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4h7v7H4V4Z" fill="white" opacity="0.9" />
            <path d="M13 4h7v7h-7V4Z" fill="white" opacity="0.6" />
            <path d="M4 13h7v7H4v-7Z" fill="white" opacity="0.6" />
            <path d="M13 13h7v7h-7v-7Z" fill="white" opacity="0.9" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[oklch(0.17_0.015_280)]">The Sensory</h1>
        <p className="mt-1 text-sm text-[oklch(0.5_0.01_260)]">Sign in to your account</p>
      </div>

      <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-[oklch(0.35_0.01_280)]">
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
            <Label htmlFor="password" className="text-sm font-medium text-[oklch(0.35_0.01_280)]">
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
            className="h-11 w-full rounded-xl bg-[oklch(0.637_0.237_25.331)] text-sm font-semibold text-white hover:bg-[oklch(0.57_0.237_25.331)] transition-colors"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
