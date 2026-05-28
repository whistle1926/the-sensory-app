"use client";

/**
 * "Create Summary" dialog for a report.
 *
 * Flow:
 *   1. Pick audience (clinical / parent)
 *   2. Click Generate → Claude returns ~180-word summary
 *   3. Review + tweak in an editable textarea
 *   4. Fill To / CC / Subject (pre-filled where sensible)
 *   5. Send → Mailcub mailer wraps it in our branded HTML and ships
 *
 * Single dialog handles all of it so the OT never has to context-
 * switch between "generate" and "send" — match the invoice send UX.
 */
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  clientName: string;
  /** Optional default for the To field — usually the parent's email. */
  defaultTo?: string;
}

type Audience = "clinical" | "parent";

export function ReportSummaryDialog({
  open,
  onOpenChange,
  reportId,
  clientName,
  defaultTo,
}: Props) {
  const [audience, setAudience] = useState<Audience>("clinical");
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [to, setTo] = useState(defaultTo ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Summary — ${clientName} (OT)`);
  const [personalNote, setPersonalNote] = useState("");
  const [signatures, setSignatures] = useState<Array<{ id: string; label: string; body: string }>>([]);
  const [signatureId, setSignatureId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Load the user's saved signatures once the dialog opens. We do
  // this on open (not on mount) so the picker reflects any edits the
  // user made in Settings while the page was open.
  useEffect(() => {
    if (!open) return;
    fetch("/api/settings/signatures")
      .then((r) => r.json())
      .then((data: { signatures: Array<{ id: string; label: string; body: string }> }) => {
        const list = Array.isArray(data.signatures) ? data.signatures : [];
        setSignatures(list);
        // Default to the first saved signature if the user hasn't picked one yet.
        setSignatureId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setSignatures([]));
  }, [open]);

  async function generate() {
    setError(null);
    setGenerating(true);
    setSummary("");
    try {
      const res = await fetch(`/api/reports/${reportId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Generate failed (${res.status})`);
      }
      const { summary: text } = (await res.json()) as { summary: string };
      setSummary(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    setError(null);
    if (!to.trim()) {
      setError("To address is required.");
      return;
    }
    if (!summary.trim()) {
      setError("Generate or write a summary first.");
      return;
    }
    setSending(true);
    try {
      const chosenSig = signatures.find((s) => s.id === signatureId);
      const res = await fetch(`/api/reports/${reportId}/email-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          cc,
          subject,
          body: summary,
          personalNote: personalNote.trim() || undefined,
          signature: chosenSig?.body || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Send failed (${res.status})`);
      }
      setSent(true);
      setTimeout(() => {
        onOpenChange(false);
        // Reset for next time the dialog opens
        setSent(false);
        setSummary("");
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function close() {
    if (sending || generating) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="!max-w-none !w-[96vw] sm:!w-[88vw] sm:!max-w-none max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create &amp; send summary</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* ── Left: audience + summary editor ── */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Audience</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAudience("clinical")}
                  disabled={generating || sending}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs transition-colors ${
                    audience === "clinical"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <Stethoscope className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-semibold text-foreground">
                      Clinical
                    </span>
                    <span className="text-muted-foreground">
                      For GP, SENCO, fellow OT
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudience("parent")}
                  disabled={generating || sending}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs transition-colors ${
                    audience === "parent"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-semibold text-foreground">
                      Parent
                    </span>
                    <span className="text-muted-foreground">
                      Warm, plain English
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="summary-body">Summary</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={generate}
                  disabled={generating || sending}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                  )}
                  {summary ? "Regenerate" : "Generate"}
                </Button>
              </div>
              <Textarea
                id="summary-body"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={14}
                placeholder="Click Generate to draft the summary — or type your own."
                className="font-sans text-sm leading-relaxed"
                disabled={sending}
              />
              <p className="text-xs text-muted-foreground">
                Edit freely before sending. Empty paragraphs separate
                sections in the final email.
              </p>
            </div>
          </div>

          {/* ── Right: email fields + preview hint ── */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="summary-note">
                Personal note{" "}
                <span className="font-normal text-muted-foreground">
                  (optional, appears above the summary)
                </span>
              </Label>
              <Textarea
                id="summary-note"
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                rows={3}
                placeholder="Hi Sarah, hope you're well. Sending across a quick summary of Cara's session today…"
                className="font-sans text-sm leading-relaxed"
                disabled={sending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary-sig">Sign off with</Label>
              {signatures.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No signatures saved yet.{" "}
                  <a
                    href="/settings?tab=profile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Add one in Settings → Profile
                  </a>{" "}
                  and it will appear here.
                </p>
              ) : (
                <select
                  id="summary-sig"
                  value={signatureId}
                  onChange={(e) => setSignatureId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={sending}
                >
                  <option value="">No signature</option>
                  {signatures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary-to">To</Label>
              <Input
                id="summary-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary-cc">
                CC <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="summary-cc"
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="another@example.com"
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary-subject">Subject</Label>
              <Input
                id="summary-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                <Mail className="mr-1 inline h-3 w-3" />
                What gets sent
              </p>
              <p className="mt-1">
                Your summary text wrapped in The Sensory Submarine&apos;s
                branded email shell. Sender:
                <span className="font-mono text-foreground"> info@mail.thesensorysubmarine.com</span>.
                A confidentiality footer is added automatically.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
                <X className="mr-1 inline h-4 w-4" />
                {error}
              </div>
            )}
            {sent && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                Sent.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending || generating}
          >
            Close
          </Button>
          <Button
            onClick={send}
            disabled={sending || generating || !summary.trim() || !to.trim() || sent}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : sent ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Sent
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send summary
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
