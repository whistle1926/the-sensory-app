"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

interface ClientValues {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  diagnosis: string;
  presentingConcerns: string;
  referrer: string;
  parentCarerName: string;
  parentCarerEmail: string;
}

export function ClientProfileEditor({ client }: { client: ClientValues }) {
  const router = useRouter();
  const [values, setValues] = useState<ClientValues>(client);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof ClientValues>(key: K, val: ClientValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const body: Record<string, string> = {
      firstName: values.firstName,
      lastName: values.lastName,
      dateOfBirth: values.dateOfBirth,
      diagnosis: values.diagnosis,
      presentingConcerns: values.presentingConcerns,
      referrer: values.referrer,
      parentCarerName: values.parentCarerName,
      parentCarerEmail: values.parentCarerEmail,
    };

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }));
        setError(typeof data.error === "string" ? data.error : "Please check the form fields");
        setSaving(false);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={values.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={values.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth *</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={values.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input
              id="diagnosis"
              value={values.diagnosis}
              onChange={(e) => update("diagnosis", e.target.value)}
              placeholder="e.g. ASD, Sensory Processing Disorder"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="presentingConcerns">Presenting Concerns</Label>
            <Textarea
              id="presentingConcerns"
              rows={3}
              value={values.presentingConcerns}
              onChange={(e) => update("presentingConcerns", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referrer">Referring Clinician</Label>
            <Input
              id="referrer"
              value={values.referrer}
              onChange={(e) => update("referrer", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="parentCarerName">Parent/Carer Name</Label>
              <Input
                id="parentCarerName"
                value={values.parentCarerName}
                onChange={(e) => update("parentCarerName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentCarerEmail">Parent/Carer Email</Label>
              <Input
                id="parentCarerEmail"
                type="email"
                value={values.parentCarerEmail}
                onChange={(e) => update("parentCarerEmail", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Adding or changing the parent email will create or re-link a portal account and send a set-password email.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
