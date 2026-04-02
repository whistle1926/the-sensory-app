"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        dateOfBirth: form.get("dateOfBirth"),
        diagnosis: form.get("diagnosis") || undefined,
        presentingConcerns: form.get("presentingConcerns") || undefined,
        referrer: form.get("referrer") || undefined,
        parentCarerName: form.get("parentCarerName") || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors ? "Please check the form fields" : "Failed to create client");
      return;
    }

    router.push("/clients");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Add New Client</h1>
      <Card>
        <CardHeader>
          <CardTitle>Client Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Input id="diagnosis" name="diagnosis" placeholder="e.g. ASD, Sensory Processing Disorder" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="presentingConcerns">Presenting Concerns</Label>
              <Textarea
                id="presentingConcerns"
                name="presentingConcerns"
                placeholder="Describe the main concerns..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referrer">Referring Clinician</Label>
              <Input id="referrer" name="referrer" placeholder="e.g. Dr Sarah Mitchell, Community Paediatrician" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentCarerName">Parent/Carer Name</Label>
              <Input id="parentCarerName" name="parentCarerName" placeholder="e.g. Claire O'Connor (mother)" />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Client"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
