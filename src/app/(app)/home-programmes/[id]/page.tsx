"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { HomeProgrammeEditor } from "@/components/reports/home-programme-editor";
import { ProgrammeBodyView } from "@/components/reports/programme-body-view";

interface ClientLite {
  id: string;
  firstName: string;
  lastName: string;
  parentCarerName?: string | null;
  parentCarerEmail?: string | null;
}

interface Programme {
  id: string;
  title: string;
  body: string;
  status: string;
  sentAt: string | null;
  sentTo: string | null;
  clientId: string | null;
  client: ClientLite | null;
  author: { name: string } | null;
}

export default function HomeProgrammePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable working copy.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [clientId, setClientId] = useState<string>("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  // Send dialog state.
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/home-programmes/${id}`).then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ])
      .then(([prog, cls]: [Programme, ClientLite[]]) => {
        setProgramme(prog);
        setTitle(prog.title ?? "");
        setBody(prog.body ?? "");
        setClientId(prog.clientId ?? "");
        setClients(Array.isArray(cls) ? cls : []);
        if (searchParams.get("edit") === "1") setEditing(true);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/home-programmes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, clientId: clientId || null }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Partial<Programme>;
        setProgramme((prev) =>
          prev
            ? {
                ...prev,
                title,
                body,
                clientId: clientId || null,
                client:
                  clients.find((c) => c.id === clientId) ?? null,
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

  if (!programme) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          Home programme not found.
        </p>
        <Link
          href="/home-programmes"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home Programmes
        </Link>
      </div>
    );
  }

  const sent = programme.status === "sent";
  const linkedClient =
    clients.find((c) => c.id === clientId) ?? programme.client;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/home-programmes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Home Programmes
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
              {programme.sentTo ? ` · ${programme.sentTo}` : ""}
            </span>
          )}
          {!editing ? (
            <>
              <a
                href={`/api/home-programmes/${id}/pdf`}
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
                <Send className="h-4 w-4" /> Send to parent
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
                  // Revert working copy and leave edit mode.
                  setTitle(programme.title);
                  setBody(programme.body);
                  setClientId(programme.clientId ?? "");
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
                placeholder="Home Programme"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
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
                Linking a child shows this on their profile and pre-fills the
                parent&apos;s email when you send it.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Programme</label>
              <HomeProgrammeEditor value={body} onChange={setBody} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">{programme.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {linkedClient
                  ? `For ${linkedClient.firstName} ${linkedClient.lastName}`
                  : "Not linked to a child"}
                {programme.author?.name ? ` · ${programme.author.name}` : ""}
              </p>
            </div>
            {programme.body.trim() ? (
              <ProgrammeBodyView body={programme.body} />
            ) : (
              <p className="text-sm italic text-muted-foreground">
                This home programme is empty. Click <strong>Edit</strong> to add
                activities, templates and leaflets.
              </p>
            )}
          </div>
        )}
      </div>

      {sendOpen && (
        <SendDialog
          programmeId={id}
          defaultTo={linkedClient?.parentCarerEmail ?? ""}
          parentName={linkedClient?.parentCarerName ?? ""}
          childName={
            linkedClient
              ? `${linkedClient.firstName} ${linkedClient.lastName}`
              : ""
          }
          title={programme.title}
          onClose={() => setSendOpen(false)}
          onSent={(to) => {
            setProgramme((prev) =>
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
/*  Send-to-parent dialog                                              */
/* ------------------------------------------------------------------ */

function SendDialog({
  programmeId,
  defaultTo,
  parentName,
  childName,
  title,
  onClose,
  onSent,
}: {
  programmeId: string;
  defaultTo: string;
  parentName: string;
  childName: string;
  title: string;
  onClose: () => void;
  onSent: (to: string) => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(
    childName ? `${title} for ${childName}` : title,
  );
  const [message, setMessage] = useState(
    `Hi ${parentName || "there"},\n\nPlease find ${childName ? `${childName}'s` : "the"} home programme below. Let me know if you have any questions.\n\nBest wishes`,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/home-programmes/${programmeId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message, isHtml: false }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
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
          <h2 className="text-base font-semibold">Send home programme</h2>
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
              placeholder="parent@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {!defaultTo && (
              <p className="text-xs text-amber-600">
                No parent email on file for this child — type one in, or add it
                on their profile.
              </p>
            )}
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
              The full programme is attached below your message, branded with
              the Sensory Submarine logo.
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
