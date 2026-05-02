"use client";

/**
 * Automations tab — list of email automations attached to bookings.
 *
 * Each row can be toggled on/off, edited (subject + body HTML), and reset
 * to the shipped default. Default automations ("confirmation",
 * "reminder_24h") can't be deleted because the send code references them
 * by key — disabling is the right escape hatch.
 *
 * Variables available in templates: {{client_name}}, {{service}},
 * {{date}}, {{time}}, {{duration}}, {{price}}, {{deposit}}, {{terms}}.
 */
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Automation {
  id: string;
  key: string;
  label: string;
  description: string;
  triggerType: string;
  triggerHoursBefore: number | null;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  isDefault: boolean;
}

const VARIABLE_HINTS: { name: string; description: string }[] = [
  { name: "client_name", description: "Client's full name" },
  { name: "service", description: "Service title (e.g. 'Initial OT Consultation')" },
  { name: "date", description: "Appointment date (e.g. 'Friday, 17 May 2026')" },
  { name: "time", description: "Time string (e.g. '10:30')" },
  { name: "duration", description: "Duration text (e.g. '60 minutes')" },
  { name: "price", description: "Price formatted as £x" },
  { name: "deposit", description: "Deposit amount if applicable, else empty" },
  { name: "terms", description: "T&Cs HTML block from the booking agreement" },
];

export function AutomationsSection() {
  const [items, setItems] = useState<Automation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/booking-automations")
      .then(async (r) => {
        if (!r.ok) throw new Error("Couldn't load automations");
        return r.json();
      })
      .then(setItems)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
  }, []);

  function patch(id: string, updated: Partial<Automation>) {
    setItems((prev) =>
      prev ? prev.map((a) => (a.id === id ? { ...a, ...updated } : a)) : prev,
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Email automations</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sent automatically via Mailcub. Toggle on/off and edit the
              wording. Use {"{{variable}}"} placeholders — see the list below
              each editor.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {items === null && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading automations…
        </div>
      )}

      {items?.map((a) => (
        <AutomationCard key={a.id} item={a} onPatch={(u) => patch(a.id, u)} />
      ))}

      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Available variables
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {VARIABLE_HINTS.map((v) => (
            <div
              key={v.name}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <code className="font-mono text-primary">{`{{${v.name}}}`}</code>
              <span className="ml-2 text-muted-foreground">{v.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutomationCard({
  item,
  onPatch,
}: {
  item: Automation;
  onPatch: (u: Partial<Automation>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(item.subject);
  const [bodyHtml, setBodyHtml] = useState(item.bodyHtml);
  const [saving, setSaving] = useState<"toggle" | "save" | "reset" | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = subject !== item.subject || bodyHtml !== item.bodyHtml;

  async function callPatch(body: Record<string, unknown>, kind: typeof saving) {
    setSaving(kind);
    try {
      const res = await fetch(`/api/booking-automations/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`PATCH ${res.status}`);
      const updated = (await res.json()) as Automation;
      onPatch(updated);
      setSubject(updated.subject);
      setBodyHtml(updated.bodyHtml);
      setSavedAt(Date.now());
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{item.label}</h3>
            {item.isDefault && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Default
              </span>
            )}
            {item.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Off
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <Clock className="mr-1 inline h-3 w-3 align-[-1px]" />
            {item.triggerType === "on_booking"
              ? "Triggers immediately when a booking is created."
              : item.triggerType === "before_appointment"
                ? `Triggers ${item.triggerHoursBefore ?? 24} hours before the appointment.`
                : item.triggerType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Toggle
            checked={item.enabled}
            disabled={saving === "toggle"}
            onChange={(next) => callPatch({ enabled: next }, "toggle")}
          />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-border bg-card p-2 transition hover:bg-muted/50"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Body (HTML)
            </label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-[12px] leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {savedAt && Date.now() - savedAt < 5000 ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Saved
                </>
              ) : dirty ? (
                "Unsaved changes."
              ) : (
                "All saved."
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => callPatch({ resetToDefault: true }, "reset")}
                disabled={!item.isDefault || saving !== null}
                className="rounded-xl"
              >
                {saving === "reset" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Reset to default
              </Button>
              <Button
                onClick={() => callPatch({ subject, bodyHtml }, "save")}
                disabled={!dirty || saving !== null}
                className="rounded-xl"
              >
                {saving === "save" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
              <SendTestButton automationId={item.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/** Small "Send test" button for the editor footer. Currently opens a
 * placeholder alert; wiring this to a real test endpoint is a 30-min
 * follow-up if Patrick wants it. */
function SendTestButton({ automationId }: { automationId: string }) {
  return (
    <Button
      variant="outline"
      onClick={() =>
        alert(
          "Test send isn't wired yet — for now, save your changes and create a real booking to verify. Tell Claude if you want a 'Send test to my email' button.",
        )
      }
      className="rounded-xl"
      data-automation-id={automationId}
    >
      <Send className="mr-2 h-4 w-4" />
      Send test
    </Button>
  );
}
