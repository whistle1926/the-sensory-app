"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

export default function NewReportPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <NewReportPage />
    </Suspense>
  );
}

function NewReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId") || "";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setGenerating(true);

    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.get("clientId"),
        sessionDate: form.get("sessionDate"),
        sessionNumber: Number(form.get("sessionNumber")),
        rawNotes: form.get("rawNotes"),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors ? "Please check the form fields" : "Failed to generate report. Please try again.");
      setGenerating(false);
      return;
    }

    const { reportId } = await res.json();
    router.push(`/reports/${reportId}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Generate Report</h1>

      {generating ? (
        <GeneratingPanel />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>
              Select a client, enter the session details, and paste your session notes. Claude will generate a structured OT report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              <div className="space-y-2">
                <Label htmlFor="clientId">Client *</Label>
                <select
                  id="clientId"
                  name="clientId"
                  required
                  defaultValue={preselectedClientId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sessionDate">Session Date *</Label>
                  <Input
                    id="sessionDate"
                    name="sessionDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionNumber">Session Number *</Label>
                  <Input
                    id="sessionNumber"
                    name="sessionNumber"
                    type="number"
                    min="1"
                    required
                    defaultValue="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rawNotes">Session Notes *</Label>
                <Textarea
                  id="rawNotes"
                  name="rawNotes"
                  required
                  rows={15}
                  placeholder="Paste your raw session notes here. Include observations about sensory responses, behaviours, interventions used, and the child's response. The more detail you provide, the better the report."
                />
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Tip — AI will populate the Functional Review automatically.</p>
                  <p className="mt-1">
                    If you mention any of these areas in your notes — even briefly — AI will summarise
                    them in clinical language: <span className="font-medium">Feeding &amp; Eating, Personal Care &amp; Dressing, Toileting,
                    Sleep, School, Other Concerns, Discussion with Parent/Carer</span>.
                  </p>
                  <p className="mt-1">
                    For areas you didn&apos;t cover, AI will draft a <em>&ldquo;Suggested follow-up&rdquo;</em>
                    prompt based on the child&apos;s diagnosis so you have a starter to edit instead
                    of an empty box.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading}>
                  Generate Report
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generating panel — animated step indicator + elapsed timer        */
/* ------------------------------------------------------------------ */

// The AI call runs ~25-35s now that Claude has to fill in the
// Functional Review fields with reasoned follow-up prompts. A plain
// spinner makes that feel longer than it is — these stepped messages
// + an elapsed counter give a sense of progress.
function GeneratingPanel() {
  const STEPS = [
    "Reading your session notes…",
    "Identifying observations and behaviours…",
    "Drafting assessment findings…",
    "Populating Functional Review (Feeding, Sleep, School…)…",
    "Generating goals and recommendations…",
    "Finalising the report…",
  ];

  const [elapsed, setElapsed] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    // Cycle through steps roughly every ~5s so by ~30s we land on the
    // last one. If the actual response is slower we just hold there.
    const advance = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, 5000);
    return () => clearInterval(advance);
  }, [STEPS.length]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 py-14">
        <Loader2 className="h-10 w-10 animate-spin text-primary/70" />
        <div className="text-center">
          <p className="text-lg font-semibold">Generating your report…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Typically 25–35 seconds. Claude is reading your notes and writing a
            structured OT report.
          </p>
        </div>

        {/* Stepwise progress */}
        <div className="w-full max-w-md space-y-1.5">
          {STEPS.map((label, i) => {
            const state =
              i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
            return (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  state === "done"
                    ? "text-muted-foreground"
                    : state === "active"
                      ? "bg-primary/5 font-medium text-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    state === "done"
                      ? "bg-primary/15 text-primary"
                      : state === "active"
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                {label}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground tabular-nums">
          {elapsed}s elapsed
        </p>
      </CardContent>
    </Card>
  );
}
