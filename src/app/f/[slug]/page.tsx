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
import { SubmarineHeader } from "@/components/storefront/submarine-header";
import {
  type FormField,
  type SubmissionData,
  type UploadedFile,
  isLayoutOnly,
} from "@/lib/forms";

const STATUS_CARD =
  "sub-edge-xl w-full max-w-md rounded-[34px] bg-white p-8 text-center sm:p-10";
const CENTRE =
  "flex flex-1 items-center justify-center px-5 py-16 sm:py-20";

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
      <div className="sub flex min-h-screen flex-col">
        <SubmarineHeader />
        <div className={CENTRE}>
          <div className={STATUS_CARD}>
            <AlertCircle className="mx-auto h-10 w-10 text-[#B81243]" />
            <h1 className="sub-display mt-4 text-[30px]">Form not available</h1>
            <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">{loadError}</p>
            <Link
              href="/"
              className="sub-edge sub-press mt-6 inline-flex items-center gap-2 rounded-full bg-[#FFC93C] px-6 py-3.5 text-[15px] font-extrabold text-[#12235B]"
            >
              Return home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="sub flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B7794]" />
      </div>
    );
  }

  // If the form requires sign-in and the session is still loading, wait.
  // If it's confirmed unauthenticated, show a gate with a sign-in button.
  if (form.settings.requireLogin) {
    if (sessionStatus === "loading") {
      return (
        <div className="sub flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#6B7794]" />
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
        <div className="sub flex min-h-screen flex-col">
          <SubmarineHeader />
          <div className={CENTRE}>
            <div className={STATUS_CARD}>
              <Lock className="mx-auto h-10 w-10 text-[#6B7794]" />
              <h1 className="sub-display mt-4 text-[30px]">{form.title}</h1>
              <p className="mt-2 text-[15px] font-semibold text-[#3D4A6B]">
                Please sign in to complete this form.
              </p>
              <Link
                href={`/login?callbackUrl=${callback}`}
                className="sub-edge sub-press mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white"
                style={{ background: "var(--sub-pink)" }}
              >
                Sign in to continue
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  if (submitted) {
    return (
      <div className="sub flex min-h-screen flex-col">
        <SubmarineHeader />
        <div className={CENTRE}>
          <div className={STATUS_CARD}>
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#17B0A7]" />
            <h1 className="sub-display mt-4 text-[30px]">Thanks!</h1>
            <p className="mt-2 whitespace-pre-line text-[15px] font-semibold text-[#3D4A6B]">
              {submitted}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sub min-h-screen">
      <SubmarineHeader />
      <main className="px-5 py-12 sm:py-16">
      <form
        onSubmit={submit}
        className="sub-edge-xl mx-auto max-w-2xl space-y-6 rounded-[34px] bg-white p-6 sm:p-10"
      >
        <div>
          <h1 className="sub-display text-[34px] tracking-[-1px] sm:text-[44px]">{form.title}</h1>
          {form.description && (
            <p className="mt-2 whitespace-pre-line text-base font-semibold text-[#5A6785]">
              {form.description}
            </p>
          )}
        </div>

        {errors.__global && (
          <div className="rounded-[18px] border-2 border-[#FBC7D7] bg-[#FFE7EE] px-4 py-3.5 text-sm font-bold text-[#B81243]">
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

        <div className="space-y-6">
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
          className="sub-display sub-edge-lg sub-press inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-xl text-white disabled:opacity-60"
          style={{ background: "var(--sub-pink)" }}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : null}
          {form.settings.submitButtonText || "Submit"}
        </button>
      </form>
      </main>
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
      <h2 className="sub-display pt-2 text-2xl" id={`field-${field.id}`}>
        {field.label}
      </h2>
    );
  }
  if (field.type === "paragraph") {
    return (
      <p
        className="whitespace-pre-line text-[15px] font-semibold text-[#3D4A6B]"
        id={`field-${field.id}`}
      >
        {field.label}
      </p>
    );
  }

  const labelNode = (
    <label
      htmlFor={`input-${field.id}`}
      className="mb-2 block text-sm font-extrabold"
    >
      {field.label || <span className="italic text-[#6B7794]">Untitled</span>}
      {field.required && <span className="ml-0.5 text-[#E71D57]">*</span>}
    </label>
  );

  const help = field.helpText && (
    <p className="mt-2 px-2 text-sm font-semibold text-[#6B7794]">{field.helpText}</p>
  );

  const errorNode = error && (
    <p className="mt-2 px-2 text-sm font-bold text-[#B81243]">{error}</p>
  );

  const fieldBase =
    "w-full border-[3px] border-[#D9D2C4] bg-[#FFFCF6] px-[18px] py-4 text-base font-semibold text-[#12235B] outline-none placeholder:text-[#9AA3B8] focus:border-[#12235B] focus:bg-white";
  const inputBase = `${fieldBase} rounded-full`;
  const boxBase = `${fieldBase} rounded-[18px]`;

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
                className={boxBase}
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
                className={boxBase}
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
              <div className="space-y-2.5">
                {(field.options ?? []).map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-3 text-[15px] font-semibold text-[#3D4A6B]"
                  >
                    <input
                      type="radio"
                      name={field.id}
                      value={o.value}
                      checked={value === o.value}
                      onChange={() => setValue(o.value)}
                      required={field.required}
                      className="h-[18px] w-[18px] accent-[#12235B]"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            );
          case "checkbox": {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            return (
              <div className="space-y-2.5">
                {(field.options ?? []).map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-3 text-[15px] font-semibold text-[#3D4A6B]"
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
                      className="h-[18px] w-[18px] rounded accent-[#12235B]"
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
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setValue(n)}
                    className={`sub-display h-11 w-11 rounded-full border-[3px] text-lg transition-colors ${
                      current === n
                        ? "border-[#12235B] bg-[#12235B] text-white"
                        : "border-[#D9D2C4] bg-[#FFFCF6] text-[#12235B] hover:border-[#12235B]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {(field.scale?.minLabel || field.scale?.maxLabel) && (
                  <div className="ml-2 text-xs font-semibold text-[#6B7794]">
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
        <div className="flex items-center justify-between gap-2 rounded-[18px] border-[3px] border-[#D9D2C4] bg-[#FFFCF6] px-[18px] py-3 text-sm font-semibold">
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-extrabold text-[#E71D57] hover:text-[#B81243]"
          >
            {current.filename}
          </a>
          <button
            type="button"
            onClick={() => setValue(null)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6B7794] hover:bg-[#FFE7EE] hover:text-[#B81243]"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-[18px] border-[3px] border-dashed border-[#D9D2C4] bg-[#FFFCF6] px-[18px] py-4 text-[15px] font-semibold text-[#6B7794] transition-colors hover:border-[#12235B] hover:bg-white ${
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
        <p className="px-2 text-sm font-bold text-[#B81243]">{uploadError}</p>
      )}
      <p className="px-2 text-xs font-semibold text-[#6B7794]">
        Max {field.maxSizeMb ?? 10} MB
      </p>
    </div>
  );
}
