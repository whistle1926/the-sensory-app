"use client";

/**
 * Admin for the free downloads on /resources, and the list of people who
 * have asked for them.
 *
 * The consent column is the important one: it says who may be emailed about
 * new courses and who may not. Wanting an activity sheet isn't agreeing to
 * marketing, so the two are kept visibly apart.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { upload as blobUpload } from "@vercel/blob/client";
import { Download, ExternalLink, Loader2, Plus, Trash2, Upload, Users } from "lucide-react";
import { Toolbar } from "@/components/ds";

interface Resource {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  downloads: number;
  _count: { leads: number };
}

interface Lead {
  id: string;
  email: string;
  name: string;
  marketingConsent: boolean;
  createdAt: string;
  resource: { title: string };
}

export default function FreeResourcesAdmin() {
  const [rows, setRows] = useState<Resource[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<"files" | "leads">("files");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string } | null>(null);
  const [pendingThumb, setPendingThumb] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([
      fetch("/api/free-resources").then((x) => (x.ok ? x.json() : [])),
      fetch("/api/free-resources/leads").then((x) => (x.ok ? x.json() : [])),
    ]);
    setRows(Array.isArray(r) ? r : []);
    setLeads(Array.isArray(l) ? l : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function pick(ref: React.RefObject<HTMLInputElement | null>, kind: "file" | "thumb") {
    const f = ref.current?.files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const blob = await blobUpload(f.name, f, {
        access: "public",
        handleUploadUrl: "/api/uploads/blob",
      });
      if (kind === "file") setPendingFile({ url: blob.url, name: f.name });
      else setPendingThumb(blob.url);
    } catch {
      setError("That file wouldn't upload. Try a smaller one.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function create() {
    if (!title.trim() || !pendingFile) {
      setError("Give it a title and choose a file.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/free-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          fileUrl: pendingFile.url,
          fileName: pendingFile.name,
          thumbnailUrl: pendingThumb,
        }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || "Couldn't save that.");
        return;
      }
      setTitle(""); setDescription(""); setPendingFile(null); setPendingThumb(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: Resource) {
    await fetch(`/api/free-resources/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
    load();
  }

  async function remove(r: Resource) {
    if (!confirm(`Delete "${r.title}"? Anyone who already downloaded it keeps their copy.`)) return;
    await fetch(`/api/free-resources/${r.id}`, { method: "DELETE" });
    load();
  }

  const consented = leads.filter((l) => l.marketingConsent).length;
  const input = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-6">
      <Toolbar
        title="Free resources"
        subtitle="Downloads offered on the public site in exchange for an email address."
        actions={
          <a
            href="/resources"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"
          >
            See the public page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <div className="flex gap-2">
        {(["files", "leads"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold ${
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            {t === "files" ? `Downloads (${rows.length})` : `People (${leads.length})`}
          </button>
        ))}
      </div>

      {tab === "files" ? (
        <>
          <section className="rounded-2xl border-2 border-dashed border-border p-5">
            <h2 className="text-sm font-bold">Add a download</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="Title, e.g. Fine motor activity sheet" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className={input} placeholder="One line on what it helps with" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={() => pick(fileRef, "file")} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                <Upload className="h-3.5 w-3.5" />
                {pendingFile ? `File: ${pendingFile.name}` : "Choose the file"}
              </button>
              <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={() => pick(thumbRef, "thumb")} />
              <button onClick={() => thumbRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                <Upload className="h-3.5 w-3.5" />
                {pendingThumb ? "Preview image added" : "Preview image (optional)"}
              </button>
              <button onClick={create} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add it
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </section>

          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Nothing offered yet.
              </p>
            )}
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                {r.thumbnailUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.thumbnailUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg border border-border object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.description || r.fileName}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <Download className="mr-1 inline h-3 w-3" />
                  {r.downloads}
                </span>
                <button onClick={() => toggle(r)} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${r.isActive ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                  {r.isActive ? "LIVE" : "OFF"}
                </button>
                <button onClick={() => remove(r)} aria-label="Delete" className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <strong>{consented}</strong> of {leads.length} have agreed to hear about new courses.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only email the ones who said yes — wanting a free sheet isn&apos;t
              agreeing to be marketed at, and they were told as much.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Wanted</th>
                  <th className="px-4 py-2">Can email?</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-medium">{l.email}</td>
                    <td className="px-4 py-2 text-muted-foreground">{l.name || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{l.resource.title}</td>
                    <td className="px-4 py-2">
                      {l.marketingConsent ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">YES</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">NO</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(l.createdAt).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nobody yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
