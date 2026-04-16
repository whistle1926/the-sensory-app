"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  ExternalLink,
  Send,
  User,
  Loader2,
  MoreHorizontal,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface IntakeItem {
  id: string;
  type: string;
  label: string;
  url: string | null;
  status: string;
  sentAt: string | null;
  completedAt: string | null;
  notes: string | null;
  fileUrl: string | null;
  createdAt: string;
}

interface NewClient {
  id: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  parentCarerName: string | null;
  parentCarerEmail: string | null;
  stage: { id: string; label: string; colour: string } | null;
  intakeItems: IntakeItem[];
}

interface NewClientsSectionProps {
  clients: NewClient[];
  onRefresh: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ITEM_TYPES = [
  "Parent Questionnaire",
  "Sensory Processing Measure",
  "Custom",
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "sent":
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "sent":
      return "Sent";
    default:
      return "Pending";
  }
}

/* ------------------------------------------------------------------ */
/*  Add Item Dialog                                                    */
/* ------------------------------------------------------------------ */

function AddItemDialog({
  clientId,
  open,
  onOpenChange,
  onRefresh,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<string>(ITEM_TYPES[0]);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          type,
          url: url.trim() || null,
        }),
      });
      onOpenChange(false);
      setLabel("");
      setType(ITEM_TYPES[0]);
      setUrl("");
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Intake Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-label">Label *</Label>
            <Input
              id="item-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Sensory Profile Caregiver Questionnaire"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => { if (v) setType(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-url">URL (optional)</Label>
            <Input
              id="item-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!label.trim() || saving}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Intake Item Row                                                    */
/* ------------------------------------------------------------------ */

function IntakeItemRow({
  item,
  clientId,
  onRefresh,
}: {
  item: IntakeItem;
  clientId: string;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      await fetch(`/api/clients/${clientId}/intake/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${item.label}"?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/clients/${clientId}/intake/${item.id}`, {
        method: "DELETE",
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 transition-opacity",
        loading && "opacity-50 pointer-events-none"
      )}
    >
      <div className="mt-0.5 flex-shrink-0">
        <StatusIcon status={item.status} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
            >
              {item.label}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          ) : (
            <span className="text-sm font-medium">{item.label}</span>
          )}
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
          >
            {item.type}
          </Badge>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{statusLabel(item.status)}</span>
          {item.sentAt && <span>Sent {formatDate(item.sentAt)}</span>}
          {item.completedAt && (
            <span>Completed {formatDate(item.completedAt)}</span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-xs" className="flex-shrink-0" />
          }
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.status !== "sent" && (
            <DropdownMenuItem onClick={() => updateStatus("sent")}>
              <Send className="h-3.5 w-3.5" />
              Mark as Sent
            </DropdownMenuItem>
          )}
          {item.status !== "completed" && (
            <DropdownMenuItem onClick={() => updateStatus("completed")}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark as Completed
            </DropdownMenuItem>
          )}
          {item.status !== "pending" && (
            <DropdownMenuItem onClick={() => updateStatus("pending")}>
              <Circle className="h-3.5 w-3.5" />
              Reset to Pending
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Client Card                                                        */
/* ------------------------------------------------------------------ */

function ClientCard({
  client,
  onRefresh,
}: {
  client: NewClient;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const completedCount = client.intakeItems.filter(
    (i) => i.status === "completed"
  ).length;
  const totalCount = client.intakeItems.length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex-shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground">
            {client.firstName} {client.lastName}
          </span>
          {client.parentCarerName && (
            <p className="text-xs text-muted-foreground truncate">
              Parent/Carer: {client.parentCarerName}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {client.stage && (
            <Badge
              variant="secondary"
              className="text-[10px] border"
              style={{
                backgroundColor: `${client.stage.colour}18`,
                borderColor: `${client.stage.colour}40`,
                color: client.stage.colour,
              }}
            >
              {client.stage.label}
            </Badge>
          )}
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <Link
              href={`/clients/${client.id}`}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
            >
              View Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-3 w-3" />
              Add Item
            </Button>
          </div>

          {client.intakeItems.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No intake items yet. Add one to start tracking.
            </p>
          ) : (
            <div className="space-y-1.5">
              {client.intakeItems.map((item) => (
                <IntakeItemRow
                  key={item.id}
                  item={item}
                  clientId={client.id}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}

          <AddItemDialog
            clientId={client.id}
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

export function NewClientsSection({ clients, onRefresh }: NewClientsSectionProps) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          New Clients
        </h2>
        {clients.length > 0 && (
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {clients.length}
          </Badge>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
          <User className="mx-auto h-6 w-6 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No clients awaiting assessment right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
