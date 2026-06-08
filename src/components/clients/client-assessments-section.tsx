"use client";

/**
 * Client record → Assessments & forms.
 *
 * Interactive replacement for the old read-only "Forms & assessments"
 * feed. Lets the OT:
 *   - Add an assessment (SPM / parent questionnaire / custom). The SPM
 *     option pre-fills the standard WPS Hub link from Practice Settings
 *     so it's one click.
 *   - Attach the completed result — paste a link or upload the PDF
 *     (stored via /api/uploads/intake-file).
 *   - Track status: pending → sent → completed.
 *   - Open the link / view the result / delete an item.
 *
 * Form invites (built in /forms and sent to the client) are listed
 * read-only underneath, since they're managed from the Forms area.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileUp,
  Link2,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, Chip, Empty } from "@/components/ds";

export interface IntakeItem {
  id: string;
  type: string;
  label: string;
  url: string | null;
  fileUrl: string | null;
  status: string; // pending | sent | completed
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
}

export interface FormRow {
  id: string;
  label: string;
  status: string;
  when: string; // ISO
  href: string;
}

interface Props {
  clientId: string;
  clientFirstName: string;
  initialItems: IntakeItem[];
  formRows: FormRow[];
  spmLinkUrl: string;
}

const TYPE_PRESETS = [
  { value: "spm", label: "Sensory Processing Measure (SPM)" },
  { value: "parent_questionnaire", label: "Parent Questionnaire" },
  { value: "custom", label: "Other / custom" },
] as const;

function typeBadge(type: string): string {
  if (type === "spm") return "SPM";
  if (type === "parent_questionnaire") return "Questionnaire";
  return "Assessment";
}

function statusTone(status: string): "success" | "warn" | "neutral" {
  if (status === "completed") return "success";
  if (status === "sent") return "warn";
  return "neutral";
}

export function ClientAssessmentsSection({
  clientId,
  clientFirstName,
  initialItems,
  formRows,
  spmLinkUrl,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<IntakeItem[]>(initialItems);
  const [addOpen, setAddOpen] = useState(false);

  /* ---------- add dialog state ---------- */
  const [type, setType] = useState<string>("spm");
  const [label, setLabel] = useState<string>(TYPE_PRESETS[0].label);
  const [url, setUrl] = useState<string>(spmLinkUrl);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const addFileRef = useRef<HTMLInputElement>(null);

  /* row-level busy flags keyed by item id */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const rowFileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  function resetDialog() {
    setType("spm");
    setLabel(TYPE_PRESETS[0].label);
    setUrl(spmLinkUrl);
    setResultUrl(null);
    setResultName(null);
    setError("");
  }

  function onTypeChange(next: string) {
    setType(next);
    const preset = TYPE_PRESETS.find((p) => p.value === next);
    // Re-default label + link for the chosen type. SPM pre-fills the
    // standard link; others start blank.
    setLabel(next === "custom" ? "" : (preset?.label ?? ""));
    setUrl(next === "spm" ? spmLinkUrl : "");
  }

  /* ---------- upload a result file (returns blob url) ---------- */
  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads/intake-file", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Upload failed");
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  async function onAddFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-pick of same file
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const u = await uploadFile(file);
      setResultUrl(u);
      setResultName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function createItem() {
    if (!label.trim()) {
      setError("Give the assessment a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // If a result is attached, mark completed; else if there's a link
      // it's been shared (sent); otherwise pending.
      const status = resultUrl ? "completed" : url.trim() ? "sent" : "pending";
      const res = await fetch(`/api/clients/${clientId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          label: label.trim(),
          url: url.trim() || undefined,
          fileUrl: resultUrl || undefined,
          status,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't add the assessment");
      }
      const created = (await res.json()) as IntakeItem;
      setItems((prev) => [created, ...prev]);
      setAddOpen(false);
      resetDialog();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- patch helpers ---------- */
  async function patchItem(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/clients/${clientId}/intake/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = (await res.json()) as IntakeItem;
        setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/clients/${clientId}/intake/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        setConfirmDeleteId(null);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onRowFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const targetId = uploadTargetId;
    e.target.value = "";
    setUploadTargetId(null);
    if (!file || !targetId) return;
    setBusyId(targetId);
    try {
      const u = await uploadFile(file);
      if (u) await patchItem(targetId, { fileUrl: u, status: "completed" });
    } catch {
      // surfaced via no-op; keep simple
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Assessments &amp; forms
        </span>
      }
      actions={
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) resetDialog();
          }}
        >
          <DialogTrigger
            render={
              <Button size="sm" className="rounded-xl" />
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add assessment
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add an assessment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="spm-type">Type</Label>
                <select
                  id="spm-type"
                  value={type}
                  onChange={(e) => onTypeChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {TYPE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="spm-label">Name</Label>
                <Input
                  id="spm-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Sensory Processing Measure (SPM)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spm-link">Assessment link</Label>
                <Input
                  id="spm-link"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://hub.wpspublish.com/landing"
                />
                <p className="text-[11px] text-muted-foreground">
                  {type === "spm"
                    ? "Pre-filled with your standard SPM link. Share this with the parent to complete online."
                    : "Optional — paste the link the parent uses to complete this."}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Completed result (optional)</Label>
                {resultUrl ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    <span className="truncate">{resultName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setResultUrl(null);
                        setResultName(null);
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-red-500"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    disabled={uploading}
                    onClick={() => addFileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="mr-2 h-4 w-4" />
                    )}
                    {uploading ? "Uploading…" : "Upload SPM result (PDF)"}
                  </Button>
                )}
                <input
                  ref={addFileRef}
                  type="file"
                  accept="application/pdf,image/*,.doc,.docx"
                  className="hidden"
                  onChange={onAddFilePicked}
                />
                <p className="text-[11px] text-muted-foreground">
                  You can add this now, or upload it later when the parent
                  finishes the assessment.
                </p>
              </div>
              <Button
                onClick={createItem}
                disabled={saving || uploading}
                className="w-full rounded-xl"
              >
                {saving ? "Adding…" : "Add to record"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Hidden file input for per-row "upload result" */}
      <input
        ref={rowFileRef}
        type="file"
        accept="application/pdf,image/*,.doc,.docx"
        className="hidden"
        onChange={onRowFilePicked}
      />

      {items.length === 0 && formRows.length === 0 ? (
        <Empty>
          No assessments or forms for {clientFirstName} yet. Add the SPM or
          another assessment to get started.
        </Empty>
      ) : (
        <div className="divide-y divide-border">
          {/* Interactive intake items */}
          {items.map((it) => {
            const busy = busyId === it.id;
            const when = it.completedAt ?? it.sentAt ?? it.createdAt;
            return (
              <div key={it.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{it.label}</p>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        {typeBadge(it.type)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(when).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <Chip tone={statusTone(it.status)}>{it.status}</Chip>
                </div>

                {/* actions */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {it.url && (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
                    >
                      <Link2 className="h-3 w-3" />
                      Open link
                    </a>
                  )}
                  {it.fileUrl ? (
                    <a
                      href={it.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View result
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setUploadTargetId(it.id);
                        rowFileRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
                    >
                      <FileUp className="h-3 w-3" />
                      Upload result
                    </button>
                  )}
                  {it.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patchItem(it.id, { status: "sent" })}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
                    >
                      <Send className="h-3 w-3" />
                      Mark sent
                    </button>
                  )}
                  {it.status !== "completed" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patchItem(it.id, { status: "completed" })}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950/30"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Mark completed
                    </button>
                  )}
                  {confirmDeleteId === it.id ? (
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteItem(it.id)}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {busy ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDeleteId(it.id)}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Read-only form invites (managed in /forms) */}
          {formRows.map((row) => (
            <a
              key={row.id}
              href={row.href}
              className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/20"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Form · {new Date(row.when).toLocaleDateString("en-GB")}
                </p>
              </div>
              <Chip
                tone={
                  row.status === "submitted"
                    ? "success"
                    : row.status === "sent"
                      ? "warn"
                      : "primary"
                }
              >
                {row.status}
              </Chip>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}
