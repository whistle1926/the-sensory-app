"use client";

/**
 * Bookings → Services — admin editor for the BookingService catalogue.
 *
 * Each service is a row in a table view: title, category, price,
 * duration, active toggle, share-URL copy, edit, delete. Click "Edit"
 * to open an inline panel with all the editable fields.
 *
 * Public lookups against this table power /book and /book/[slug].
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ServiceRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  tagline: string | null;
  category: string;
  pricePence: number;
  durationLabel: string;
  durationMinutes: number;
  depositPence: number;
  isActive: boolean;
  autoSendReferralForm: boolean;
  autoSendFeedbackForm?: boolean;
  minSessions: number;
  maxSessions: number;
  order: number;
  ownerId: string | null;
  ownerName: string | null;
  mode: string;
  locationLabel: string | null;
}

interface StaffOption {
  id: string;
  name: string;
}

export function ServicesSection() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "SUPER_ADMIN";
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refresh() {
    try {
      // ?all=1 includes inactive rows for the editor.
      const res = await fetch("/api/booking-services?all=1");
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = (await res.json()) as ServiceRow[];
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't load services");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Owner assignment is admin-only, so only admins need the staff list
  // for the dropdown. /api/users is SUPER_ADMIN-gated anyway. Extracted
  // so the editor can refresh it after adding a new therapist inline.
  const loadStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch("/api/users");
      const users = (r.ok ? await r.json() : []) as Array<{
        id: string;
        name: string;
        role: string;
        isAutomation?: boolean;
      }>;
      setStaff(
        users
          .filter(
            (u) =>
              (u.role === "SUPER_ADMIN" || u.role === "TEAM_MANAGER") &&
              !u.isAutomation,
          )
          .map((u) => ({ id: u.id, name: u.name })),
      );
    } catch {
      /* non-fatal — dropdown just stays as-is */
    }
  }, [isAdmin]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.slug.includes(q),
    );
  }, [rows, search]);

  async function createService() {
    setBusy(true);
    try {
      const res = await fetch("/api/booking-services", { method: "POST" });
      if (res.ok) {
        const created = (await res.json()) as { id: string };
        await refresh();
        setEditingId(created.id);
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(body.error ?? "Couldn't create service.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function patchService(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/booking-services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteService(id: string, title: string) {
    if (
      !confirm(
        `Delete "${title}"?\n\nThis only works if no existing bookings reference the service. Archive (Active = off) is safer for retiring a service.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/booking-services/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Couldn't delete service.");
      } else {
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyShareLink(slug: string) {
    const url = `${window.location.origin}/book/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(slug);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  if (rows === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading services…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Booking services</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The catalogue shown on{" "}
              <a
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                /book
              </a>
              . Each row has its own shareable URL at{" "}
              <code className="rounded bg-muted px-1 font-mono text-primary">
                /book/&lt;slug&gt;
              </code>{" "}
              that pre-selects the service for ads + WhatsApp messages.
            </p>
          </div>
          <Button
            onClick={createService}
            disabled={busy}
            className="rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            New service
          </Button>
        </div>

        <div className="relative mt-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, category, or slug…"
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-950/40"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-semibold">
            {search ? "No services match this search." : "No services yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((svc) =>
            editingId === svc.id ? (
              <EditorPanel
                key={svc.id}
                service={svc}
                staff={staff}
                isAdmin={isAdmin}
                reloadStaff={loadStaff}
                onCancel={() => setEditingId(null)}
                onSave={async (next) => {
                  await patchService(svc.id, next);
                  setEditingId(null);
                }}
                busy={busy}
              />
            ) : (
              <ListRow
                key={svc.id}
                service={svc}
                copiedShareLink={copiedId === svc.slug}
                onEdit={() => setEditingId(svc.id)}
                onToggleActive={() =>
                  patchService(svc.id, { isActive: !svc.isActive })
                }
                onCopyLink={() => copyShareLink(svc.slug)}
                onDelete={() => deleteService(svc.id, svc.title)}
                busy={busy}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ListRow({
  service,
  copiedShareLink,
  onEdit,
  onToggleActive,
  onCopyLink,
  onDelete,
  busy,
}: {
  service: ServiceRow;
  copiedShareLink: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const priceLabel =
    service.pricePence === 0
      ? "Free"
      : `£${(service.pricePence / 100).toFixed(
          service.pricePence % 100 === 0 ? 0 : 2,
        )}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{service.title}</h3>
            {service.category && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {service.category}
              </span>
            )}
            {!service.isActive && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Inactive
              </span>
            )}
            {service.depositPence > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                £{service.depositPence / 100} deposit
              </span>
            )}
            {service.mode === "online" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Globe className="h-2.5 w-2.5" />
                Online
              </span>
            )}
            {service.mode === "home" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Home visit
              </span>
            )}
            {service.locationLabel && service.mode !== "online" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                {service.locationLabel}
              </span>
            )}
            {service.ownerName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                <User className="h-2.5 w-2.5" />
                {service.ownerName}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 max-w-3xl text-xs text-muted-foreground">
            {service.tagline || service.description.slice(0, 200) || "—"}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{priceLabel}</span>
            <span>·</span>
            <span>{service.durationLabel}</span>
            <span>·</span>
            <code className="rounded bg-muted px-1 font-mono">
              /book/{service.slug}
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleActive}
            disabled={busy}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold tracking-wider transition ${
              service.isActive
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-300"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
            title={service.isActive ? "Set to Inactive" : "Set to Active"}
          >
            {service.isActive ? "LIVE" : "OFF"}
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
            title="Copy share URL"
          >
            {copiedShareLink ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Share link
              </>
            )}
          </button>
          <a
            href={`/book/${service.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
            title="Preview public page"
          >
            <ExternalLink className="h-3 w-3" />
            Preview
          </a>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
            title="Delete service"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline editor — sits in-place of the row when editing. Saves to
 * /api/booking-services/[id] PATCH on click. */
function EditorPanel({
  service,
  staff,
  isAdmin,
  reloadStaff,
  onCancel,
  onSave,
  busy,
}: {
  service: ServiceRow;
  staff: StaffOption[];
  isAdmin: boolean;
  reloadStaff: () => Promise<void>;
  onCancel: () => void;
  onSave: (next: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState(service.title);
  const [category, setCategory] = useState(service.category);
  const [tagline, setTagline] = useState(service.tagline ?? "");
  const [description, setDescription] = useState(service.description);
  const [pricePence, setPricePence] = useState(service.pricePence);
  const [depositPence, setDepositPence] = useState(service.depositPence);
  const [durationLabel, setDurationLabel] = useState(service.durationLabel);
  const [durationMinutes, setDurationMinutes] = useState(
    service.durationMinutes,
  );
  const [isActive, setIsActive] = useState(service.isActive);
  const [autoSendReferralForm, setAutoSendReferralForm] = useState(
    service.autoSendReferralForm,
  );
  const [autoSendFeedbackForm, setAutoSendFeedbackForm] = useState(
    service.autoSendFeedbackForm ?? false,
  );
  const [minSessions, setMinSessions] = useState(service.minSessions ?? 1);
  const [maxSessions, setMaxSessions] = useState(service.maxSessions ?? 1);
  const isBlock = maxSessions > 1;
  const [ownerId, setOwnerId] = useState<string>(service.ownerId ?? "");
  const [mode, setMode] = useState(service.mode || "in_person");
  const [locationLabel, setLocationLabel] = useState(service.locationLabel ?? "");

  // ── Inline "Add a new therapist" ────────────────────────────────
  // Lets an admin create a therapist's login (name + email) right here
  // and have them assigned as this service's owner — no developer step.
  // The therapist gets a "set your password" email; once they're the
  // owner, ticking Active below takes the clinic live.
  const [addingTherapist, setAddingTherapist] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNote, setAddNote] = useState<string | null>(null);

  async function addTherapist() {
    setAddError(null);
    setAddNote(null);
    setAddBusy(true);
    try {
      const res = await fetch(
        `/api/booking-services/${service.id}/assign-owner`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, email: newEmail }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ownerId?: string;
        ownerName?: string;
        created?: boolean;
        emailSent?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ownerId)
        throw new Error(data.error ?? `Failed (${res.status})`);
      await reloadStaff();
      setOwnerId(data.ownerId);
      setAddNote(
        data.created
          ? data.emailSent
            ? `${data.ownerName} added and assigned. A “set your password” email has been sent to them.`
            : `${data.ownerName} added and assigned. (Couldn't send the setup email — check email settings; they can use “Forgot password”.)`
          : `${data.ownerName} was already a staff member — now assigned to this service.`,
      );
      setAddingTherapist(false);
      setNewName("");
      setNewEmail("");
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add therapist");
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Edit service</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Slug:{" "}
            <code className="rounded bg-muted px-1 font-mono">
              {service.slug}
            </code>{" "}
            (locked — preserve link share history)
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`title-${service.id}`}>Title</Label>
          <Input
            id={`title-${service.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`cat-${service.id}`}>Category</Label>
          <Input
            id={`cat-${service.id}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Parents & individuals"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tag-${service.id}`}>Tagline</Label>
          <Input
            id={`tag-${service.id}`}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One-line summary"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`price-${service.id}`}>Price (£)</Label>
          <Input
            id={`price-${service.id}`}
            type="number"
            min={0}
            step="1"
            value={pricePence / 100}
            onChange={(e) =>
              setPricePence(Math.max(0, Math.round(Number(e.target.value) * 100)))
            }
          />
          <p className="text-xs text-muted-foreground">
            {pricePence === 0 ? "Free / on enquiry" : `£${pricePence / 100}`}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`deposit-${service.id}`}>Deposit (£)</Label>
          <Input
            id={`deposit-${service.id}`}
            type="number"
            min={0}
            step="1"
            value={depositPence / 100}
            onChange={(e) =>
              setDepositPence(
                Math.max(0, Math.round(Number(e.target.value) * 100)),
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Optional non-refundable deposit. 0 = none.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`dur-${service.id}`}>Duration label</Label>
          <Input
            id={`dur-${service.id}`}
            value={durationLabel}
            onChange={(e) => setDurationLabel(e.target.value)}
            placeholder="60 minutes"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`durmins-${service.id}`}>Duration (mins)</Label>
          <Input
            id={`durmins-${service.id}`}
            type="number"
            min={0}
            step="5"
            value={durationMinutes}
            onChange={(e) =>
              setDurationMinutes(Math.max(0, Number(e.target.value) || 0))
            }
          />
          <p className="text-xs text-muted-foreground">
            Used by the calendar for slot math.
          </p>
        </div>

        {/* Owner — admin only. Drives whose calendar the bookings hit
            and who can self-serve this service's availability. */}
        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor={`owner-${service.id}`}>Run by</Label>
            <select
              id={`owner-${service.id}`}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">The practice (default calendar)</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              The associate who runs this. They manage its availability and
              get its bookings.
            </p>

            {/* Add-a-therapist inline creator */}
            {!addingTherapist ? (
              <button
                type="button"
                onClick={() => {
                  setAddingTherapist(true);
                  setAddError(null);
                  setAddNote(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add a new therapist…
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium">
                  Create a therapist&apos;s login and assign them here
                </p>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name (e.g. Catherine Feehan)"
                  className="h-9"
                />
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email address"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  We&apos;ll email them a link to set their own password. Tick{" "}
                  <strong>Active</strong>{" "}below once they&apos;re assigned to
                  take the clinic live.
                </p>
                {addError && (
                  <p className="text-xs text-red-600">{addError}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={addTherapist}
                    disabled={addBusy || !newName.trim() || !newEmail.trim()}
                    className="h-8 rounded-lg text-xs"
                  >
                    {addBusy ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Add &amp; assign
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAddingTherapist(false);
                      setAddError(null);
                    }}
                    disabled={addBusy}
                    className="h-8 rounded-lg text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {addNote && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-400">
                {addNote}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`mode-${service.id}`}>Delivery</Label>
          <select
            id={`mode-${service.id}`}
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="in_person">In person (clinic)</option>
            <option value="online">Online (video)</option>
            <option value="home">Home visit</option>
          </select>
        </div>

        {mode !== "online" && (
          <div className="space-y-2">
            <Label htmlFor={`loc-${service.id}`}>Location</Label>
            <Input
              id={`loc-${service.id}`}
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Armagh, Antrim, Ballymoney…"
            />
            <p className="text-xs text-muted-foreground">
              Shown as a badge on the booking card.
            </p>
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`desc-${service.id}`}>Description</Label>
          <textarea
            id={`desc-${service.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Full description shown on the booking + landing pages…"
          />
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Active</p>
            <p className="text-xs text-muted-foreground">
              When off, the service is hidden from <code>/book</code> and{" "}
              <code>/book/&lt;slug&gt;</code>{" "}404s. Existing bookings remain.
            </p>
          </div>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
          />
        </label>
        {/* Sessions per booking — 1/1 is a normal appointment; set a range
            (e.g. 2–5) to make this a block the client picks several dates
            for, charged per session. */}
        <div className="rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
          <p className="text-sm font-medium">Sessions per booking</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Leave both at 1 for a normal single appointment. For a block, set
            a range (e.g. 2 to 5) — the client picks that many dates and is
            charged the price above <strong>per session</strong>.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Label htmlFor={`min-${service.id}`} className="text-xs">
              From
            </Label>
            <Input
              id={`min-${service.id}`}
              type="number"
              min={1}
              max={20}
              value={minSessions}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setMinSessions(v);
                if (v > maxSessions) setMaxSessions(v);
              }}
              className="h-9 w-20 rounded-lg"
            />
            <Label htmlFor={`max-${service.id}`} className="text-xs">
              to
            </Label>
            <Input
              id={`max-${service.id}`}
              type="number"
              min={1}
              max={20}
              value={maxSessions}
              onChange={(e) =>
                setMaxSessions(
                  Math.max(minSessions, Number(e.target.value) || 1),
                )
              }
              className="h-9 w-20 rounded-lg"
            />
            <span className="text-xs text-muted-foreground">
              {isBlock
                ? `Block: client picks ${minSessions}–${maxSessions} dates · up to ${maxSessions} × £${
                    pricePence / 100
                  } = £${(pricePence * maxSessions) / 100}`
                : "Single appointment"}
            </span>
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">
              Send referral form on payment
            </p>
            <p className="text-xs text-muted-foreground">
              When a booking for this service is paid, the client is
              automatically emailed the intake/referral form. Recommended for
              OT assessments.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoSendReferralForm}
            onChange={(e) => setAutoSendReferralForm(e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">
              Send feedback form 1 week after appointment
            </p>
            <p className="text-xs text-muted-foreground">
              A week after a booking for this service, the client is
              automatically emailed the feedback form. Recommended for OT
              assessments.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoSendFeedbackForm}
            onChange={(e) => setAutoSendFeedbackForm(e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="rounded-xl"
        >
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              title,
              category,
              tagline,
              description,
              pricePence,
              depositPence,
              durationLabel,
              durationMinutes,
              isActive,
              autoSendReferralForm,
              autoSendFeedbackForm,
              minSessions,
              maxSessions,
              mode,
              locationLabel: locationLabel.trim() || null,
              // Only admins may change ownership; omit otherwise so the
              // API's admin-only guard isn't tripped by associates.
              ...(isAdmin ? { ownerId: ownerId || null } : {}),
            })
          }
          disabled={busy}
          className="rounded-xl"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Save changes
        </Button>
      </div>
    </div>
  );
}
