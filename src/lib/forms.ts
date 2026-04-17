// Canonical types + sanitisers for Form fields, settings, and submissions.
// Mirrors the JSON columns on the Form / FormSubmission models.
//
// Used on every read/write boundary:
//   - admin POST/PATCH /api/forms — sanitises incoming builder payloads
//   - public POST /api/forms/public/[slug]/submit — validates responses
//   - server pages + client builder — for consistent types

export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "rating"
  | "file"
  | "heading"
  | "paragraph";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  helpText?: string;
  required?: boolean;
  placeholder?: string;
  options?: FormFieldOption[]; // select | radio | checkbox
  scale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  }; // rating
  accept?: string[]; // file — mime prefixes, e.g. ["image/", "application/pdf"]
  maxSizeMb?: number; // file
}

export interface FormAutoReply {
  enabled: boolean;
  subject: string;
  body: string;
}

export interface FormSettings {
  submitButtonText?: string;
  successMessage?: string;
  notifyEmails?: string[];
  replyToEmail?: string;
  autoReply?: FormAutoReply;
  // When true the public URL requires a signed-in session; unauthenticated
  // visitors are bounced to /login with a callback. Default false = anyone
  // with the link can submit.
  requireLogin?: boolean;
}

// ── Uploaded file shape (value of a `file` field) ───────────────────
export interface UploadedFile {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

// ── Layout-only types have no collected value ───────────────────────
export const LAYOUT_ONLY_TYPES: ReadonlyArray<FormFieldType> = [
  "heading",
  "paragraph",
];

export function isLayoutOnly(type: FormFieldType): boolean {
  return LAYOUT_ONLY_TYPES.includes(type);
}

// ── Field type catalogue for the builder "Add field" menu ───────────
export const FIELD_TYPE_CATALOGUE: Array<{
  type: FormFieldType;
  label: string;
  group: "text" | "choice" | "date-number" | "file" | "layout";
}> = [
  { type: "short_text", label: "Short text", group: "text" },
  { type: "long_text", label: "Long text", group: "text" },
  { type: "email", label: "Email", group: "text" },
  { type: "phone", label: "Phone", group: "text" },
  { type: "select", label: "Dropdown", group: "choice" },
  { type: "radio", label: "Multiple choice", group: "choice" },
  { type: "checkbox", label: "Checkboxes", group: "choice" },
  { type: "rating", label: "Rating / scale", group: "choice" },
  { type: "date", label: "Date", group: "date-number" },
  { type: "number", label: "Number", group: "date-number" },
  { type: "file", label: "File upload", group: "file" },
  { type: "heading", label: "Heading", group: "layout" },
  { type: "paragraph", label: "Paragraph / info", group: "layout" },
];

// ───────────────────────────────────────────────────────────────────────
// Sanitisers — run on anything coming in from the network or DB before use.
// ───────────────────────────────────────────────────────────────────────

const VALID_TYPES: ReadonlyArray<FormFieldType> = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "date",
  "select",
  "radio",
  "checkbox",
  "rating",
  "file",
  "heading",
  "paragraph",
];

function sanitiseOptions(input: unknown): FormFieldOption[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: FormFieldOption[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { label?: unknown; value?: unknown };
    const label = typeof e.label === "string" ? e.label.trim() : "";
    const value =
      typeof e.value === "string" && e.value.trim()
        ? e.value.trim()
        : label;
    if (!label) continue;
    out.push({ label, value });
  }
  return out.length > 0 ? out : undefined;
}

function sanitiseScale(input: unknown): FormField["scale"] {
  if (!input || typeof input !== "object") return undefined;
  const e = input as {
    min?: unknown;
    max?: unknown;
    minLabel?: unknown;
    maxLabel?: unknown;
  };
  const min = typeof e.min === "number" ? Math.floor(e.min) : 1;
  const max = typeof e.max === "number" ? Math.floor(e.max) : 5;
  if (!(max > min)) return { min: 1, max: 5 };
  return {
    min,
    max,
    minLabel: typeof e.minLabel === "string" ? e.minLabel : undefined,
    maxLabel: typeof e.maxLabel === "string" ? e.maxLabel : undefined,
  };
}

function randomId(): string {
  // Prefer crypto.randomUUID() when available (Node 18+, modern browsers).
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `f_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function sanitiseFormField(input: unknown): FormField | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const type = typeof raw.type === "string" ? raw.type : "";
  if (!VALID_TYPES.includes(type as FormFieldType)) return null;

  const label = typeof raw.label === "string" ? raw.label.trim() : "";

  const field: FormField = {
    id: typeof raw.id === "string" && raw.id ? raw.id : randomId(),
    type: type as FormFieldType,
    label,
  };

  if (typeof raw.helpText === "string" && raw.helpText.trim())
    field.helpText = raw.helpText.trim();
  if (typeof raw.placeholder === "string" && raw.placeholder.trim())
    field.placeholder = raw.placeholder.trim();
  if (raw.required === true) field.required = true;

  if (["select", "radio", "checkbox"].includes(field.type)) {
    const options = sanitiseOptions(raw.options);
    if (options) field.options = options;
  }

  if (field.type === "rating") {
    field.scale = sanitiseScale(raw.scale) ?? { min: 1, max: 5 };
  }

  if (field.type === "file") {
    if (Array.isArray(raw.accept)) {
      const accept = raw.accept.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      );
      if (accept.length > 0) field.accept = accept;
    }
    if (typeof raw.maxSizeMb === "number" && raw.maxSizeMb > 0) {
      field.maxSizeMb = Math.min(Math.floor(raw.maxSizeMb), 20);
    }
  }

  return field;
}

export function sanitiseFormFields(input: unknown): FormField[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(sanitiseFormField)
    .filter((f): f is FormField => f !== null);
}

export function sanitiseFormSettings(input: unknown): FormSettings {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: FormSettings = {};

  if (typeof raw.submitButtonText === "string" && raw.submitButtonText.trim())
    out.submitButtonText = raw.submitButtonText.trim().slice(0, 40);
  if (typeof raw.successMessage === "string" && raw.successMessage.trim())
    out.successMessage = raw.successMessage.trim().slice(0, 500);
  if (typeof raw.replyToEmail === "string" && isEmail(raw.replyToEmail))
    out.replyToEmail = raw.replyToEmail.trim();

  if (raw.requireLogin === true) out.requireLogin = true;

  if (Array.isArray(raw.notifyEmails)) {
    const emails = raw.notifyEmails
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim())
      .filter(isEmail);
    if (emails.length > 0) out.notifyEmails = Array.from(new Set(emails));
  }

  if (raw.autoReply && typeof raw.autoReply === "object") {
    const a = raw.autoReply as Record<string, unknown>;
    const subject = typeof a.subject === "string" ? a.subject.trim() : "";
    const body = typeof a.body === "string" ? a.body.trim() : "";
    if (subject || body) {
      out.autoReply = {
        enabled: a.enabled === true,
        subject: subject.slice(0, 200) || "Thanks for your response",
        body: body.slice(0, 4000) || "Thanks — we've received your submission.",
      };
    }
  }

  return out;
}

// ───────────────────────────────────────────────────────────────────────
// Submission validation
// ───────────────────────────────────────────────────────────────────────

export type SubmissionValue =
  | string
  | string[]
  | number
  | UploadedFile
  | null
  | undefined;

export type SubmissionData = Record<string, SubmissionValue>;

export interface ValidationResult {
  ok: boolean;
  clean: SubmissionData;
  errors: Record<string, string>;
}

export function isEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Deliberately loose — we only care that it's plausibly an address.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isUploadedFile(value: unknown): value is UploadedFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.url === "string" &&
    typeof v.filename === "string" &&
    typeof v.mimeType === "string" &&
    typeof v.sizeBytes === "number"
  );
}

export function validateSubmission(
  fields: FormField[],
  data: unknown,
): ValidationResult {
  const clean: SubmissionData = {};
  const errors: Record<string, string> = {};
  const incoming = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;

  for (const field of fields) {
    if (isLayoutOnly(field.type)) continue;

    const raw = incoming[field.id];
    const missing =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim() === "") ||
      (Array.isArray(raw) && raw.length === 0);

    if (missing) {
      if (field.required) {
        errors[field.id] = "This field is required.";
      }
      continue;
    }

    switch (field.type) {
      case "short_text":
      case "long_text":
      case "phone": {
        if (typeof raw !== "string") {
          errors[field.id] = "Please enter text.";
          break;
        }
        clean[field.id] = raw.trim().slice(0, 5000);
        break;
      }
      case "email": {
        if (typeof raw !== "string" || !isEmail(raw)) {
          errors[field.id] = "Please enter a valid email address.";
          break;
        }
        clean[field.id] = raw.trim();
        break;
      }
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n)) {
          errors[field.id] = "Please enter a number.";
          break;
        }
        clean[field.id] = n;
        break;
      }
      case "date": {
        if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          errors[field.id] = "Please pick a date.";
          break;
        }
        clean[field.id] = raw;
        break;
      }
      case "select":
      case "radio": {
        if (typeof raw !== "string") {
          errors[field.id] = "Please pick an option.";
          break;
        }
        const allowed = (field.options ?? []).map((o) => o.value);
        if (!allowed.includes(raw)) {
          errors[field.id] = "Please pick one of the listed options.";
          break;
        }
        clean[field.id] = raw;
        break;
      }
      case "checkbox": {
        const arr = Array.isArray(raw)
          ? raw.filter((v): v is string => typeof v === "string")
          : [];
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        const filtered = arr.filter((v) => allowed.has(v));
        if (field.required && filtered.length === 0) {
          errors[field.id] = "Please pick at least one option.";
          break;
        }
        clean[field.id] = filtered;
        break;
      }
      case "rating": {
        const n = typeof raw === "number" ? raw : Number(raw);
        const { min = 1, max = 5 } = field.scale ?? {};
        if (!Number.isFinite(n) || n < min || n > max) {
          errors[field.id] = `Please pick a value between ${min} and ${max}.`;
          break;
        }
        clean[field.id] = n;
        break;
      }
      case "file": {
        if (!isUploadedFile(raw)) {
          errors[field.id] = "Please upload a file.";
          break;
        }
        clean[field.id] = raw;
        break;
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, clean, errors };
}

/**
 * Extract name + email from a validated submission so they can be stored on
 * convenience columns for quick filtering in the entries viewer.
 */
export function extractSubmitterContact(
  fields: FormField[],
  clean: SubmissionData,
): { submitterName: string | null; submitterEmail: string | null } {
  let submitterEmail: string | null = null;
  let submitterName: string | null = null;
  for (const field of fields) {
    const value = clean[field.id];
    if (field.type === "email" && typeof value === "string" && !submitterEmail) {
      submitterEmail = value;
    }
    if (
      field.type === "short_text" &&
      typeof value === "string" &&
      !submitterName &&
      /name/i.test(field.label)
    ) {
      submitterName = value;
    }
  }
  return { submitterName, submitterEmail };
}
