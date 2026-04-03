"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface EmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  clientName: string;
  clientEmail?: string;
  sessionDate: string;
}

export function EmailComposeModal({
  open,
  onOpenChange,
  reportId,
  clientName,
  clientEmail,
  sessionDate,
}: EmailComposeModalProps) {
  const [to, setTo] = useState(clientEmail || "");
  const [subject, setSubject] = useState(
    `OT Session Report — ${clientName} (${sessionDate})`
  );
  const [message, setMessage] = useState(
    `Please find attached the occupational therapy session report for ${clientName}.`
  );
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    setSending(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      const res = await fetch("/api/email/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, to, subject, message }),
      });

      if (res.ok) {
        setStatus("success");
        setTimeout(() => {
          onOpenChange(false);
          setStatus("idle");
        }, 2000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to send");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error");
      setStatus("error");
    }

    setSending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-to">To</Label>
            <Input
              id="email-to"
              type="email"
              placeholder="parent@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            {!clientEmail && (
              <p className="text-xs text-muted-foreground">
                No email on file for this client. Enter one manually.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-message">Message</Label>
            <textarea
              id="email-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {status === "success" && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Email sent successfully
                </span>
              )}
              {status === "error" && (
                <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {errorMsg}
                </span>
              )}
            </div>
            <Button onClick={handleSend} disabled={sending || !to || status === "success"}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {sending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
