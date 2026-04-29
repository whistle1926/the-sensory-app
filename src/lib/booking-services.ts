/**
 * Single source of truth for the booking service catalogue.
 *
 * The public /book page used to hard-code the labels inline; both the
 * confirmation email and the 24-hour reminder need the friendly title
 * rather than the slug ("initial-ot"), so the labels live here.
 *
 * NOTE: the prices on /book are still defined in `src/app/book/page.tsx`
 * because that file also wires icons + descriptions. We only centralise
 * the bits the email senders need.
 */

export interface BookingServiceMeta {
  id: string;
  title: string;
  /** Plain-language one-liner used in the reminder email body. */
  description: string;
  /** Whether the appointment happens via video link rather than in-person. */
  online: boolean;
}

const CATALOGUE: BookingServiceMeta[] = [
  {
    id: "initial-ot",
    title: "Initial OT Consultation",
    description: "Online video consultation",
    online: true,
  },
  {
    id: "follow-up",
    title: "Follow-Up Session",
    description: "Online video session",
    online: true,
  },
  {
    id: "school",
    title: "School Consultation",
    description: "Online video consultation",
    online: true,
  },
  {
    id: "sensory-eaters",
    title: "Sensory Eaters Programme",
    description: "Online group programme",
    online: true,
  },
];

export function bookingServiceMeta(id: string): BookingServiceMeta {
  return (
    CATALOGUE.find((s) => s.id === id) ?? {
      id,
      title: id,
      description: "Appointment",
      online: false,
    }
  );
}
