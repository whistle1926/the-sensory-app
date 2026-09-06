"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2, AlertCircle, Upload, X, Lock } from "lucide-react";
import {
  type FormField,
  type SubmissionData,
  type UploadedFile,
  isLayoutOnly,
} from "@/lib/forms";

interface PublicForm {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  fields: FormField[];
  settings: {
    submitButtonText: string;
    successMessage: string;
    requireLogin?: boolean;
  };
}

export default function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = use(params);
  const sp = use(searchParams);
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const { data: session, status: sessionStatus } = useSession();

  const [form, setForm] = useState<PublicForm | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const [values, setValues] = useState<SubmissionData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState(""); // intentionally unused in UI
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Load the form
  useEffect(() => {
    fetch(`/api/forms/public/${slug}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Form not found");
        const loaded = data as PublicForm;
        setForm(loaded);
        // Pre-fill from the URL: a query param named after a field id
        // fills that field, so a link like /f/schools-enquiry?service=…
        // arrives with the service already chosen. For a dropdown the
        // value must be one of its options (matched on value or label).
        const prefill: SubmissionData = {};
        for (const field of loaded.fields) {
          const raw = sp[field.id];
          if (typeof raw !== "string" || !raw) continue;
          if (field.type === "select" || field.type === "radio") {
            const match = (field.options ?? []).find(
              (o) => o.value === raw || o.label === raw,
            );
            if (match) prefill[field.id] = match.value;
          } else if (
            field.type === "short_text" ||
            field.type === "long_text" ||
            field.type === "email" ||
            field.type === "phone"
          ) {
            prefill[field.id] = raw;
          }
        }
        if (Object.keys(prefill).length > 0) {
          setValues((prev) => ({ ...prefill, ...prev }));
        }
      })
      .catch((err) => setLoadError(err.message));
    // `sp` is stable for the life of the page (it comes from the URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Ping open endpoint if we have an invite token (best-effort)
  useEffect(() => {
    if (!token) return;
    fetch(`/api/forms/public/${slug}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [slug, token]);

  const setValue = useCallback((id: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [id]: value as SubmissionData[string] }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch(`/api/forms/public/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: values,
          token,
          website: honeypot, // honeypot, server ignores successful values
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.fieldErrors) {
          setErrors(data.fieldErrors);
          // Scroll to first error
          const firstId = Object.keys(data.fieldErrors)[0];
          if (firstId) {
            document.getElementById(`field-${firstId}`)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
          return;
        }
        throw new Error(data.error || "Submission failed");
      }
      setSubmitted(data.successMessage ?? form.settings.successMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setErrors({ __global: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-sm)]">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h1 className="mt-4 text-xl font-bold">Form not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Return home
          </Link>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If the form requires sign-in and the session is still loading, wait.
  // If it's confirmed unauthenticated, show a gate with a sign-in button.
  if (form.settings.requireLogin) {
    if (sessionStatus === "loading") {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!session?.user) {
      const callback = encodeURIComponent(
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : `/f/${slug}`,
      );
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
          <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-sm)]">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h1 className="mt-4 text-xl font-bold">{form.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please sign in to complete this form.
            </p>
            <Link
              href={`/login?callbackUrl=${callback}`}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Sign in to continue
            </Link>
          </div>
        </div>
      );
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-sm)]">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          <h1 className="mt-4 text-xl font-bold">Thanks!</h1>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {submitted}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-12">
      <form
        onSubmit={submit}
        className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] md:p-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{form.title}</h1>
          {form.description && (
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {form.description}
            </p>
          )}
        </div>

        {errors.__global && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {errors.__global}
          </div>
        )}

        {/* Honeypot — bots fill any field named "website". Invisible to humans. */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-9999px",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        <div className="space-y-5">
          {form.fields.map((field) => (
            <FieldView
              key={field.id}
              field={field}
              value={values[field.id]}
              setValue={(v) => setValue(field.id, v)}
              error={errors[field.id]}
              slug={slug}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {form.settings.submitButtonText || "Submit"}
        </button>
      </form>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Single field renderer
// ───────────────────────────────────────────────────────────────────────

function FieldView({
  field,
  value,
  setValue,
  error,
  slug,
}: {
  field: FormField;
  value: unknown;
  setValue: (v: unknown) => void;
  error?: string;
  slug: string;
}) {
  if (field.type === "heading") {
    return (
      <h2 className="pt-2 text-lg font-bold tracking-tight" id={`field-${field.id}`}>
        {field.label}
      </h2>
    );
  }
  if (field.type === "paragraph") {
    return (
      <p
        className="whitespace-pre-line text-sm text-muted-foreground"
        id={`field-${field.id}`}
      >
        {field.label}
      </p>
    );
  }

  const labelNode = (
    <label
      htmlFor={`input-${field.id}`}
      className="mb-1.5 block text-sm font-semibold"
    >
      {field.label || <span className="italic text-muted-foreground">Untitled</span>}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );

  const help = field.helpText && (
    <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>
  );

  const errorNode = error && (
    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
  );

  const inputBase =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

  return (
    <div id={`field-${field.id}`}>
      {labelNode}
      {(() => {
        switch (field.type) {
          case "short_text":
          case "email":
          case "phone":
            return (
              <input
                id={`input-${field.id}`}
                type={
                  field.type === "email"
                    ? "email"
                    : field.type === "phone"
                      ? "tel"
                      : "text"
                }
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setValue(e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                className={inputBase}
              />
            );
          case "long_text":
            return (
              <textarea
                id={`input-${field.id}`}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setValue(e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                rows={4}
                className={inputBase}
              />
            );
          case "number":
            return (
              <input
                id={`input-${field.id}`}
                type="number"
                value={value === undefined || value === null ? "" : String(value)}
                onChange={(e) => setValue(e.target.value === "" ? null : Number(e.target.value))}
                placeholder={field.placeholder}
                required={field.required}
                className={inputBase}
              />
            );
          case "date":
            return (
              <input
                id={`input-${field.id}`}
                type="date"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setValue(e.target.value)}
                required={field.required}
                className={inputBase}
              />
            );
          case "select":
            return (
              <select
                id={`input-${field.id}`}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setValue(e.target.value)}
                required={field.required}
                className={inputBase}
              >
                <option value="">Select…</option>
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          case "radio":
            return (
              <div className="space-y-1.5">
                {(field.options ?? []).map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={field.id}
                      value={o.value}
                      checked={value === o.value}
                      onChange={() => setValue(o.value)}
                      required={field.required}
                      className="h-4 w-4 accent-primary"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            );
          case "checkbox": {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            return (
              <div className="space-y-1.5">
                {(field.options ?? []).map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={arr.includes(o.value)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...arr, o.value]
                          : arr.filter((v) => v !== o.value);
                        setValue(next);
                      }}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            );
          }
          case "rating": {
            const min = field.scale?.min ?? 1;
            const max = field.scale?.max ?? 5;
            const current = typeof value === "number" ? value : null;
            return (
              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setValue(n)}
                    className={`h-10 w-10 rounded-lg border text-sm font-semibold transition-colors ${
                      current === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {(field.scale?.minLabel || field.scale?.maxLabel) && (
                  <div className="ml-2 text-[11px] text-muted-foreground">
                    {field.scale?.minLabel} — {field.scale?.maxLabel}
                  </div>
                )}
              </div>
            );
          }
          case "file":
            return (
              <FileField field={field} value={value} setValue={setValue} slug={slug} />
            );
          default:
            if (isLayoutOnly(field.type)) return null;
            return null;
        }
      })()}
      {help}
      {errorNode}
    </div>
  );
}

function FileField({
  field,
  value,
  setValue,
  slug,
}: {
  field: FormField;
  value: unknown;
  setValue: (v: unknown) => void;
  slug: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const current = useMemo(() => {
    if (
      value &&
      typeof value === "object" &&
      "url" in value &&
      "filename" in value
    ) {
      return value as UploadedFile;
    }
    return null;
  }, [value]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/forms/public/${slug}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
        return;
      }
      setValue(data);
    } catch {
      setUploadError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {current ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-primary hover:underline"
          >
            {current.filename}
          </a>
          <button
            type="button"
            onClick={() => setValue(null)}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted ${
            uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Uploading…" : "Click to choose a file"}
          <input
            type="file"
            onChange={onPick}
            accept={(field.accept ?? []).map((a) => (a.endsWith("/") ? `${a}*` : a)).join(",")}
            className="hidden"
          />
        </label>
      )}
      {uploadError && (
        <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Max {field.maxSizeMb ?? 10} MB
      </p>
    </div>
  );
}
