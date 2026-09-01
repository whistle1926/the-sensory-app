"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Download, Loader2, Send, X } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextView } from "@/components/ui/rich-text-view";

interface ClientLite {
  id: string;
  firstName: string;
  lastName: string;
  parentCarerName?: string | null;
  parentCarerEmail?: string | null;
}

interface Letter {
  id: string;
  title: string;
  recipient: string;
  body: string;
  status: string;
  sentAt: string | null;
  sentTo: string | null;
  clientId: string | null;
  client: ClientLite | null;
  author: { name: string } | null;
}

export default function LetterPage() {
  const { letterId } = useParams<{ letterId: string }>();
  const searchParams = useSearchParams();

  const [letter, setLetter] = useState<Letter | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [clientId, setClientId] = useState<string>("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/letters/${letterId}`).then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ])
      .then(([l, cls]: [Letter, ClientLite[]]) => {
        setLetter(l);
        setTitle(l.title ?? "");
        setRecipient(l.recipient ?? "");
        setBody(l.body ?? "");
        setClientId(l.clientId ?? "");
        setClients(Array.isArray(cls) ? cls : []);
        if (searchParams.get("edit") === "1") setEditing(true);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/letters/${letterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          recipient,
          body,
          clientId: clientId || null,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Partial<Letter>;
        setLetter((prev) =>
          prev
            ? {
                ...prev,
                title,
                recipient,
                body,
                clientId: clientId || null,
                client: clients.find((c) => c.id === clientId) ?? null,
                status: updated.status ?? prev.status,
              }
            : prev,
        );
        setEditing(false);
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Letter not found.</p>
        <Link
          href="/reports/letters"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Letters
        </Link>
      </div>
    );
  }

  const sent = letter.status === "sent";
  const linkedClient = clients.find((c) => c.id === clientId) ?? letter.client;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/reports/letters"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Letters
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {savedTick && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
          {sent && !editing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
              <Send className="h-3 w-3" /> Sent
              {letter.sentTo ? ` · ${letter.sentTo}` : ""}
            </span>
          )}
          {!editing ? (
            <>
              <a
                href={`/api/letters/${letterId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
              >
                <Download className="h-4 w-4" /> Download / Print
              </a>
              <button
                type="button"
                onClick={() => setSendOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-110"
              >
                <Send className="h-4 w-4" /> Send by email
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
              >
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setTitle(letter.title);
                  setRecipient(letter.recipient);
                  setBody(letter.body);
                  setClientId(letter.clientId ?? "");
                  setEditing(false);
                }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        {editing ? (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Letter"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground">
                For your own reference — it isn&apos;t printed on the letter.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Addressed to (optional)
              </label>
              <textarea
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                rows={2}
                placeholder={"e.g. The SENCO\nSpringfield Primary School"}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground">
                Shown near the top of the printed letter, under the date.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Child (optional)</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Not linked to a child —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Linking a child adds a &ldquo;Re:&rdquo; line and pre-fills the
                parent&apos;s email if you send it to them.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Letter</label>
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Write your letter here…"
                minHeight={320}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">{letter.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {linkedClient
                  ? `Re: ${linkedClient.firstName} ${linkedClient.lastName}`
                  : "Not linked to a child"}
                {letter.author?.name ? ` · ${letter.author.name}` : ""}
              </p>
            </div>
            {letter.body.trim() ? (
              <RichTextView html={letter.body} />
            ) : (
              <p className="text-sm italic text-muted-foreground">
                This letter is empty. Click <strong>Edit</strong> to write it.
              </p>
            )}
          </div>
        )}
      </div>

      {sendOpen && (
        <SendDialog
          letterId={letterId}
          defaultTo={linkedClient?.parentCarerEmail ?? ""}
          childName={
            linkedClient
              ? `${linkedClient.firstName} ${linkedClient.lastName}`
              : ""
          }
          title={letter.title}
          onClose={() => setSendOpen(false)}
          onSent={(to) => {
            setLetter((prev) =>
              prev ? { ...prev, status: "sent", sentTo: to } : prev,
            );
            setSendOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Send dialog                                                        */
/* ------------------------------------------------------------------ */

function SendDialog({
  letterId,
  defaultTo,
  childName,
  title,
  onClose,
  onSent,
}: {
  letterId: string;
  defaultTo: string;
  childName: string;
  title: string;
  onClose: () => void;
  onSent: (to: string) => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(
    childName ? `${title} — ${childName}` : title,
  );
  const [message, setMessage] = useState(
    `Hello,\n\nPlease find the letter below${childName ? ` regarding ${childName}` : ""}. Do get in touch if you have any questions.\n\nKind regards`,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/letters/${letterId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message, isHtml: false }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Send failed (${res.status})`);
      onSent(to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Send letter</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="school@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">
              A letter often goes to a school — type the address in. If it&apos;s
              for the parent and their email is on file, it&apos;s filled in for
              you.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">
              The full letter is included below your message, on the Sensory
              Submarine letterhead.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || !to}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
