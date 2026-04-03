"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/reports/rich-text-editor";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  X,
  Plus,
  Mail,
} from "lucide-react";
import Link from "next/link";

interface ReportData {
  id: string;
  status: string;
  client: {
    firstName: string;
    lastName: string;
    parentCarerName?: string;
    parentCarerEmail?: string;
  };
  reportDate: string;
  session: {
    sessionNumber: number;
  };
}

export default function EmailComposePage() {
  const { reportId } = useParams<{ reportId: string }>();
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [ccList, setCcList] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    fetch(`/api/reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data);
        setLoading(false);

        const clientName = `${data.client.firstName} ${data.client.lastName}`;
        const date = new Date(data.reportDate).toLocaleDateString("en-GB");

        setTo(data.client.parentCarerEmail || "");
        setSubject(`OT Session Report \u2014 ${clientName} (${date})`);
        setMessage(
          `<p>Dear ${data.client.parentCarerName || "Parent/Carer"},</p>` +
          `<p>Please find below the occupational therapy session report for <strong>${clientName}</strong>.</p>` +
          `<p>If you have any questions about the session or the recommendations, please don\u2019t hesitate to get in touch.</p>` +
          `<p>Kind regards</p>`
        );
      });
  }, [reportId]);

  function handleAddCc() {
    const email = ccInput.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return;
    if (ccList.includes(email) || email === to.toLowerCase()) return;
    setCcList([...ccList, email]);
    setCcInput("");
  }

  function handleRemoveCc(email: string) {
    setCcList(ccList.filter((e) => e !== email));
  }

  function handleCcKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCc();
    }
  }

  async function handleSend() {
    setSending(true);
    setStatus("idle");
    setErrorMsg("");
    setSentCount(0);

    const recipients = [to, ...ccList].filter(Boolean);
    if (recipients.length === 0) {
      setErrorMsg("Please add at least one recipient");
      setStatus("error");
      setSending(false);
      return;
    }

    let successCount = 0;
    let lastError = "";

    for (const recipient of recipients) {
      try {
        const res = await fetch("/api/email/send-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId,
            to: recipient,
            subject,
            message,
            isHtml: true,
          }),
        });

        if (res.ok) {
          successCount++;
          setSentCount(successCount);
        } else {
          const err = await res.json();
          lastError = err.error || `Failed to send to ${recipient}`;
        }
      } catch {
        lastError = `Network error sending to ${recipient}`;
      }
    }

    setSending(false);

    if (successCount === recipients.length) {
      setStatus("success");
    } else if (successCount > 0) {
      setErrorMsg(`Sent ${successCount}/${recipients.length}. ${lastError}`);
      setStatus("error");
    } else {
      setErrorMsg(lastError);
      setStatus("error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return <p className="py-10 text-center text-muted-foreground">Report not found.</p>;
  }

  const clientName = `${report.client.firstName} ${report.client.lastName}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/reports/${reportId}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Compose Email</h1>
            <p className="text-sm text-muted-foreground">
              Send report for {clientName} — Session {report.session.sessionNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Compose Form */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 p-4 sm:p-6">
          {/* To */}
          <div className="grid gap-4 sm:grid-cols-[80px_1fr] sm:items-center">
            <Label htmlFor="email-to" className="text-sm font-medium text-muted-foreground">
              To
            </Label>
            <Input
              id="email-to"
              type="email"
              placeholder="parent@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* CC */}
          <div className="grid gap-4 sm:grid-cols-[80px_1fr] sm:items-start">
            <Label className="mt-2 text-sm font-medium text-muted-foreground">CC</Label>
            <div className="space-y-2">
              {ccList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ccList.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveCc(email)}
                        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter email and press Enter to add"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={handleCcKeyDown}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCc}
                  disabled={!ccInput.trim()}
                  className="shrink-0"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each CC recipient receives a separate email (Mailcub sends individually)
              </p>
            </div>
          </div>

          {/* Subject */}
          <div className="grid gap-4 sm:grid-cols-[80px_1fr] sm:items-center">
            <Label htmlFor="email-subject" className="text-sm font-medium text-muted-foreground">
              Subject
            </Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Rich Text Editor */}
          <div>
            <Label className="mb-2 block text-sm font-medium text-muted-foreground">
              Message
            </Label>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder="Write your message here..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex-1">
            {status === "success" && (
              <span className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {sentCount > 1
                  ? `Email sent to ${sentCount} recipients`
                  : "Email sent successfully"}
              </span>
            )}
            {status === "error" && (
              <span className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                {errorMsg}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/reports/${reportId}`)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !to || status === "success"}
              className="min-w-[140px]"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending{sentCount > 0 ? ` (${sentCount})` : "..."}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
