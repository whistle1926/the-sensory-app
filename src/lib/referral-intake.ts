import crypto from "crypto";
import { prisma } from "./prisma";
import { ensureParentAccount } from "./parent-account";
import type { FormField } from "./forms";

/**
 * Referral intake — when a form flagged `settings.createsClient` is
 * submitted, map its answers onto a Client and create (or reuse) one,
 * attaching the submission to the client's folder.
 *
 * Field mapping is by label heuristics (not hard-coded field ids), so
 * it keeps working if the form is edited or rebuilt, and works for any
 * future referral form that uses sensible labels.
 */

type Data = Record<string, unknown>;

function valStr(data: Data, id: string | undefined): string {
  if (!id) return "";
  const v = data[id];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v))
    return v.filter((x) => typeof x === "string").join(", ").trim();
  if (typeof v === "number") return String(v);
  return "";
}

/** First non-layout field matching the predicate. */
function find(
  fields: FormField[],
  pred: (f: FormField, label: string) => boolean,
): FormField | undefined {
  return fields.find(
    (f) =>
      f.type !== "heading" &&
      f.type !== "paragraph" &&
      pred(f, (f.label || "").toLowerCase()),
  );
}

export interface MappedClient {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  parentCarerEmail: string;
  parentCarerName: string;
  presentingConcerns: string;
  diagnosis: string;
  address: string;
}

/** Map a referral submission's answers onto Client fields. */
export function mapReferralToClient(
  fields: FormField[],
  data: Data,
): MappedClient {
  const firstNameF =
    find(
      fields,
      (f, l) =>
        f.type === "short_text" &&
        /child/.test(l) &&
        /(first|given|fore)/.test(l),
    ) ?? find(fields, (f, l) => f.type === "short_text" && /first name/.test(l));

  const lastNameF =
    find(
      fields,
      (f, l) =>
        f.type === "short_text" &&
        /child/.test(l) &&
        /(family|last|sur)\s*name|surname/.test(l),
    ) ??
    find(
      fields,
      (f, l) =>
        f.type === "short_text" && /(family|last|sur)\s*name|surname/.test(l),
    );

  // DOB: a date field about birth — NOT the consent "Date" / signature date.
  const dobF = find(
    fields,
    (f, l) => f.type === "date" && /(birth|d\.?o\.?b)/.test(l),
  );

  const emailF = find(fields, (f) => f.type === "email");

  const parentNameF = find(
    fields,
    (f, l) =>
      f.type === "short_text" &&
      /(parent|carer|guardian)/.test(l) &&
      /name/.test(l),
  );

  const concernsF = find(
    fields,
    (f, l) =>
      (f.type === "long_text" || f.type === "short_text") &&
      /(reason|concern|achieve|like your child to see|why.*o\.?t)/.test(l),
  );

  const diagF = find(fields, (f, l) => f.type === "long_text" && /diagnos/.test(l));

  const addrF =
    find(
      fields,
      (f, l) =>
        (f.type === "long_text" || f.type === "short_text") &&
        /address/.test(l) &&
        !/parent|carer|gp/.test(l),
    ) ??
    find(
      fields,
      (f, l) => f.type === "long_text" && /address/.test(l) && !/gp/.test(l),
    );

  const dobStr = valStr(data, dobF?.id);
  let dob: Date | null = null;
  if (dobStr) {
    const d = new Date(dobStr);
    if (!Number.isNaN(d.getTime())) dob = d;
  }

  return {
    firstName: valStr(data, firstNameF?.id) || "New",
    lastName: valStr(data, lastNameF?.id) || "Referral",
    dateOfBirth: dob,
    parentCarerEmail: valStr(data, emailF?.id).toLowerCase(),
    parentCarerName: valStr(data, parentNameF?.id),
    presentingConcerns: valStr(data, concernsF?.id),
    diagnosis: valStr(data, diagF?.id),
    address: valStr(data, addrF?.id),
  };
}

/**
 * Create (or reuse) a client from a referral submission and attach the
 * submission to their folder. Never throws — returns null on failure so
 * the parent's submission still succeeds.
 */
export async function ingestReferralSubmission(opts: {
  submissionId: string;
  formId: string;
  fields: FormField[];
  data: Data;
  origin: string;
}): Promise<{ clientId: string; created: boolean } | null> {
  try {
    const m = mapReferralToClient(opts.fields, opts.data);
    const email = m.parentCarerEmail.trim();

    // De-dupe: same parent email + child name → reuse the existing client
    // rather than creating a duplicate on re-submission.
    let client =
      email && m.firstName && m.lastName
        ? await prisma.client.findFirst({
            where: {
              parentCarerEmail: { equals: email, mode: "insensitive" },
              firstName: { equals: m.firstName, mode: "insensitive" },
              lastName: { equals: m.lastName, mode: "insensitive" },
            },
            select: { id: true },
          })
        : null;

    let created = false;
    if (!client) {
      let parentId: string | undefined;
      if (email) {
        try {
          const r = await ensureParentAccount({
            email,
            name: m.parentCarerName || email,
            origin: opts.origin,
          });
          parentId = r.userId;
        } catch (err) {
          console.error("[referral-intake] parent account link failed:", err);
        }
      }
      const defaultStage = await prisma.clientStage.findFirst({
        where: { isDefault: true },
        select: { id: true },
      });
      client = await prisma.client.create({
        data: {
          firstName: m.firstName,
          lastName: m.lastName,
          // DOB is required on Client; fall back to epoch as a clear
          // "needs fixing" placeholder if the form somehow omitted it.
          dateOfBirth: m.dateOfBirth ?? new Date(0),
          parentCarerName: m.parentCarerName || null,
          parentCarerEmail: email || null,
          presentingConcerns: m.presentingConcerns || null,
          diagnosis: m.diagnosis || null,
          address: m.address || null,
          parentId,
          stageId: defaultStage?.id ?? undefined,
        },
        select: { id: true },
      });
      created = true;
    }

    // Submissions attach to a client only via FormInvite — create one
    // (already "opened/submitted") and point the submission at it so it
    // shows in the client's folder on their profile.
    const invite = await prisma.formInvite.create({
      data: {
        formId: opts.formId,
        clientId: client.id,
        email: email || "referral@form",
        token: crypto.randomBytes(24).toString("hex"),
        openedAt: new Date(),
      },
      select: { id: true },
    });
    await prisma.formSubmission.update({
      where: { id: opts.submissionId },
      data: { inviteId: invite.id },
    });

    return { clientId: client.id, created };
  } catch (err) {
    console.error("[referral-intake] failed:", err);
    return null;
  }
}
