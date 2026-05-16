/**
 * Helper for resolving a booking service's display name + format from
 * its slug. Reads from the `BookingService` table (admin-editable).
 *
 * Used by:
 *   - /api/bookings confirmation email
 *   - /api/cron/booking-reminders reminder email
 *   - /api/booking-automations/.../test sample render
 *
 * Falls back to a sane default if the slug isn't in the catalogue (so
 * an orphaned legacy booking still produces a readable email).
 */
import { prisma } from "@/lib/prisma";

export interface BookingServiceMeta {
  id: string;
  title: string;
  /** Plain-language one-liner used in the reminder email body. */
  description: string;
  /** Whether the appointment happens via video link rather than
   * in-person. Derived from the tagline / category — we treat anything
   * with "online" in it as video. */
  online: boolean;
}

/** Async lookup that reads from the DB catalogue. */
export async function bookingServiceMetaFromDb(
  id: string,
): Promise<BookingServiceMeta> {
  const row = await prisma.bookingService.findUnique({
    where: { slug: id },
    select: { slug: true, title: true, tagline: true, category: true },
  });
  if (!row) {
    return {
      id,
      title: id,
      description: "Appointment",
      online: false,
    };
  }
  const oneLiner = (row.tagline ?? row.category ?? "").toString();
  return {
    id: row.slug,
    title: row.title,
    description: oneLiner || "Appointment",
    online: /online|video|call/i.test(oneLiner),
  };
}

/**
 * Synchronous fallback used in legacy call sites that haven't been
 * converted to async yet. Only knows about the 4 original services —
 * we keep it so a stale import doesn't crash. New code should use
 * `bookingServiceMetaFromDb`.
 *
 * @deprecated use `bookingServiceMetaFromDb` instead.
 */
export function bookingServiceMeta(id: string): BookingServiceMeta {
  const FALLBACK: BookingServiceMeta[] = [
    { id: "initial-ot", title: "Initial OT Consultation", description: "Online video consultation", online: true },
    { id: "follow-up", title: "Follow-Up Session", description: "Online video session", online: true },
    { id: "school-online", title: "School Consultation", description: "Online video consultation", online: true },
    { id: "sensory-eaters", title: "Sensory Eaters Programme", description: "Online group programme", online: true },
  ];
  return (
    FALLBACK.find((s) => s.id === id) ?? {
      id,
      title: id,
      description: "Appointment",
      online: false,
    }
  );
}
