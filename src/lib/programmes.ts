/**
 * Client folders outside the main OT caseload (Grace, Oct 2026).
 *
 * A child registered through a programme's form lands in that folder:
 * `Client.programme` = the key for programme-only children (slimmed record:
 * details, brief progress notes, home programmes, their form, documents),
 * and the folder's flag column marks membership — also set on main-caseload
 * clients who join, so they keep their full record but show in the folder.
 */
export const PROGRAMMES = {
  "ot-club": {
    label: "OT Club",
    child: "OT Club child",
    flag: "otClub",
    formName: "OT Club registration form",
  },
  "school-groups": {
    label: "School groups",
    child: "school group child",
    flag: "schoolGroups",
    formName: "Small Group OT referral & consent form",
  },
} as const;

export type ProgrammeKey = keyof typeof PROGRAMMES;
export const PROGRAMME_KEYS = Object.keys(PROGRAMMES) as ProgrammeKey[];

export function isProgramme(v: unknown): v is ProgrammeKey {
  return typeof v === "string" && v in PROGRAMMES;
}

/** The Client flag columns to set for membership of a programme. */
export function programmeFlags(p: ProgrammeKey | null | undefined): {
  otClub?: boolean;
  schoolGroups?: boolean;
} {
  return p ? { [PROGRAMMES[p].flag]: true } : {};
}

/** Is this client in the folder (programme-only, or a member)? */
export function inProgramme(
  c: { programme: string | null; otClub?: boolean; schoolGroups?: boolean },
  p: ProgrammeKey,
): boolean {
  return c.programme === p || Boolean(c[PROGRAMMES[p].flag]);
}
