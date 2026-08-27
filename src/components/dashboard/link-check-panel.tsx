"use client";

/**
 * Every public address the business hands out, in one place, with a button
 * that actually visits them.
 *
 * Prompted by a receipt that pointed at an old domain: the addresses live
 * across services, courses, resources and pages, so nobody could see them
 * together, never mind check them. Collapsed by default — it's a thing you
 * go and look at, not something that should shout on the dashboard.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  X,
} from "lucide-react";

interface Row {
  group: string;
  label: string;
  url: string;
  note?: string;
  status?: number;
  ok?: boolean;
  verdict?: string;
}

export function LinkCheckPanel() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (check: boolean) => {
    if (check) setChecking(true);
    try {
      const res = await fetch(`/api/link-check${check ? "?check=1" : ""}`);
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      if (check) setChecked(true);
    } catch {
      /* leave whatever we have */
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (open && rows.length === 0) load(false);
  }, [open, rows.length, load]);

  const groups = Array.from(new Set(rows.map((r) => r.group)));
  const broken = rows.filter((r) => r.ok === false).length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Link2 className="h-4 w-4 text-primary" />
        <span className="flex-1">
          <span className="block text-base font-bold">Addresses in use</span>
          <span className="block text-xs text-muted-foreground">
            Every link a parent could be given — booking, courses, downloads.
          </span>
        </span>
        {checked && (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              broken
                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
            }`}
          >
            {broken ? `${broken} not working` : "All working"}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-border p-5">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={checking}
            className="mb-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {checking ? "Checking…" : "Check they all work"}
          </button>

          {rows.length === 0 && !checking && (
            <p className="text-sm text-muted-foreground">Nothing to show.</p>
          )}

          {groups.map((g) => (
            <div key={g} className="mb-4 last:mb-0">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {g}
              </p>
              <div className="space-y-1">
                {rows
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <div
                      key={r.url}
                      className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2"
                    >
                      {r.ok === true && <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />}
                      {r.ok === false && <X className="h-3.5 w-3.5 shrink-0 text-red-600" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.url.replace(/^https?:\/\//, "")}
                          {r.note ? ` · ${r.note}` : ""}
                        </span>
                      </span>
                      {r.verdict && (
                        /* The word, not the number. "200" tells a therapist
                           nothing; the code stays as a tooltip for when
                           someone technical needs it. */
                        <span
                          title={r.status ? `HTTP ${r.status}` : undefined}
                          className={`shrink-0 text-[11px] font-bold ${
                            r.ok ? "text-green-700 dark:text-green-400" : "text-red-600"
                          }`}
                        >
                          {r.verdict}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(r.url);
                            setCopied(r.url);
                            setTimeout(() => setCopied(null), 1500);
                          } catch {
                            /* the address is on screen to copy by hand */
                          }
                        }}
                        aria-label={`Copy the link for ${r.label}`}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {copied === r.url ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${r.label}`}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            &ldquo;Working&rdquo; means the page loaded. &ldquo;Sends you
            elsewhere&rdquo; and &ldquo;Asks you to sign in&rdquo; are both
            fine — that&apos;s what those pages are meant to do. Anything in
            red is worth a look, and the Wix and partner sites aren&apos;t
            ours to fix but are worth knowing about.
          </p>
        </div>
      )}
    </div>
  );
}
