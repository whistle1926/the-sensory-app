"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Send, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  parentCarerName: string | null;
  parentCarerEmail: string | null;
}

interface Recipient {
  email: string;
  clientId?: string;
  display: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  formId: string;
  formTitle: string;
}

export function SendFormDialog({
  open,
  onOpenChange,
  formId,
  formTitle,
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [freeEmail, setFreeEmail] = useState("");
  const [subject, setSubject] = useState(
    `${formTitle} — please complete this short form`,
  );
  const [body, setBody] = useState(
    `Hi,\n\nAhead of your upcoming OT assessment with The Sensory Submarine, please take some time to complete the referral form by following the link below:\n\nIf you've any issues or questions, please contact Claire - admin@thesensorysubmarine.com\n\nThank you and see you soon.\n\nThe Sensory Submarine Team`,
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError("");
    // Only need to fetch once.
    if (clients.length > 0) return;
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pre-fill the subject/message from this form's saved email copy
  // (settings.emailSubject / settings.emailBody) so each form carries its
  // own wording — e.g. the feedback form's thank-you note vs. the referral
  // form's pre-appointment ask. Falls back to the generic default above.
  useEffect(() => {
    if (!open) return;
    fetch(`/api/forms/${formId}`)
      .then((r) => r.json())
      .then((form) => {
        const s = (form?.settings ?? {}) as {
          emailSubject?: string;
          emailBody?: string;
        };
        if (typeof s.emailSubject === "string" && s.emailSubject.trim())
          setSubject(s.emailSubject);
        if (typeof s.emailBody === "string" && s.emailBody.trim())
          setBody(s.emailBody);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formId]);

  const filtered = search.trim()
    ? clients.filter((c) => {
        const q = search.toLowerCase();
        const full = `${c.firstName} ${c.lastName}`.toLowerCase();
        const parent = (c.parentCarerName || "").toLowerCase();
        const email = (c.parentCarerEmail || "").toLowerCase();
        return full.includes(q) || parent.includes(q) || email.includes(q);
      })
    : clients.slice(0, 10);

  function addClient(c: Client) {
    if (!c.parentCarerEmail) {
      setError(`${c.firstName} ${c.lastName} has no parent email on file.`);
      return;
    }
    if (recipients.some((r) => r.email.toLowerCase() === c.parentCarerEmail!.toLowerCase())) {
      return; // already added
    }
    setRecipients((prev) => [
      ...prev,
      {
        email: c.parentCarerEmail!,
        clientId: c.id,
        display: `${c.parentCarerName || `${c.firstName} ${c.lastName}`} (${c.parentCarerEmail})`,
      },
    ]);
    setSearch("");
    setError("");
  }

  function addFreeEmail() {
    const email = freeEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (recipients.some((r) => r.email.toLowerCase() === email.toLowerCase())) return;
    setRecipients((prev) => [...prev, { email, display: email }]);
    setFreeEmail("");
    setError("");
  }

  function removeRecipient(email: string) {
    setRecipients((prev) =>
      prev.filter((r) => r.email.toLowerCase() !== email.toLowerCase()),
    );
  }

  async function send() {
    setError("");
    if (recipients.length === 0) {
      setError("Add at least one recipient.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/forms/${formId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipients.map((r) => ({
            email: r.email,
            clientId: r.clientId,
          })),
          subject,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send.");
        return;
      }
      setResult({
        sent: Array.isArray(data.sent) ? data.sent.length : 0,
        failed: Array.isArray(data.failed) ? data.failed.length : 0,
      });
      setRecipients([]);
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send form</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
              Sent to {result.sent} recipient{result.sent === 1 ? "" : "s"}.
              {result.failed > 0 && (
                <> {result.failed} failed — check the logs.</>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recipient chips */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recipients.map((r) => (
                  <span
                    key={r.email}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                  >
                    {r.display}
                    <button
                      type="button"
                      onClick={() => removeRecipient(r.email)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove recipient"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Search clients</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a name or email"
                  className="pl-8"
                />
              </div>
              {search.trim() && filtered.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addClient(c)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span>
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.parentCarerEmail || "no email"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Or add an email directly</Label>
              <div className="flex gap-2">
                <Input
                  value={freeEmail}
                  onChange={(e) => setFreeEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFreeEmail();
                    }
                  }}
                  placeholder="someone@example.com"
                />
                <Button variant="outline" onClick={addFreeEmail}>
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
              />
              <p className="text-[11px] text-muted-foreground">
                Tokens:{" "}
                <code className="rounded bg-muted px-1 py-0.5">{"{{formTitle}}"}</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">{"{{formUrl}}"}</code>
              </p>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="-mx-4 -mb-4 flex items-center justify-between gap-2 rounded-b-xl border-t border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Each recipient gets a unique tracking link.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={send} disabled={sending || recipients.length === 0}>
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send to {recipients.length || 0}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
