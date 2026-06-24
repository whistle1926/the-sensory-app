"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Eye, Loader2, Mail, MailX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InviteRow {
  id: string;
  email: string;
  sentAt: string;
  openedAt: string | null;
  client: { id: string; firstName: string; lastName: string } | null;
  submissions: Array<{ id: string; submittedAt: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  formId: string;
  formTitle: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Read-only list of everyone a form was emailed to (FormInvite rows), with
 * a per-recipient status so staff can answer "who have we sent this to and
 * has it come back?" — opened from the "{n} sent" link on the forms list.
 */
export function RecipientsDialog({
  open,
  onOpenChange,
  formId,
  formTitle,
}: Props) {
  const [rows, setRows] = useState<InviteRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows(null);
    setError("");
    fetch(`/api/forms/${formId}/invites`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError("Couldn't load the recipient list. Please try again."));
  }, [open, formId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sent to · {formTitle}</DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : rows === null ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <MailX className="mx-auto mb-2 h-7 w-7 opacity-40" />
            This form hasn’t been emailed to anyone yet.
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((r) => {
              const submitted = r.submissions.length > 0;
              const name = r.client
                ? `${r.client.firstName} ${r.client.lastName}`.trim()
                : null;
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-background px-3.5 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.email}</span>
                      </div>
                      {name && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {name}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Sent {fmtDate(r.sentAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {submitted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </span>
                      ) : r.openedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <Eye className="h-3 w-3" />
                          Opened
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Awaiting
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
