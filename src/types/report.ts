export interface ReportContent {
  clientInfo: {
    clientName: string;
    dateOfBirth: string;
    age: string;
    sessionDate: string;
    sessionNumber: number;
    referrer: string;
    diagnosis: string;
    parentCarer: string;
  };
  reasonForReferral: string;
  sessionOverview: string;
  observations: {
    sensoryResponses: string;
    engagementParticipation: string;
    communicationSocial: string;
    emotionalRegulation: string;
  };
  assessmentFindings: {
    sensoryProcessing: string;
    fineMotor: string;
    grossMotor: string;
    selfRegulation: string;
    playFunctional: string;
  };
  /**
   * Functional Review — daily-life areas the OT checks during an
   * assessment. Optional so reports written before this section
   * existed don't fail to parse.
   */
  functionalReview?: {
    feedingAndEating?: string;
    personalCareAndDressing?: string;
    toileting?: string;
    sleep?: string;
    school?: string;
    otherConcerns?: string;
    discussionWithParent?: string;
  };
  interventionsUsed: string;
  responseToIntervention: string;
  clinicalImpressions: string;
  recommendations: string;
  goals: {
    shortTerm: string;
    longTerm: string;
    nextSessionPlan: string;
  };
  homeProgrammeSuggestions: string;
  therapistName: string;
  therapistQualifications: string;
  reportDate: string;
  reviewDate: string;
  /**
   * Optional therapist-chosen order of body sections. Items are
   * keys from REPORT_SECTION_KEYS below. When absent (older reports
   * or freshly-generated ones), the canonical order is used.
   * Renderers tolerate missing or unknown keys gracefully.
   */
  sectionOrder?: ReportSectionKey[];
}

/* ------------------------------------------------------------------ */
/*  Section ordering                                                   */
/* ------------------------------------------------------------------ */

/**
 * Stable identifiers for the reorderable body sections of a report.
 * The client-info table at the top and the therapist footer are not
 * reorderable — they're metadata, not body content.
 *
 * Adding a new key: append it to REPORT_SECTION_KEYS so older
 * reports without it in their sectionOrder still pick it up via the
 * "missing keys fall through to canonical order" merge in
 * resolveSectionOrder().
 */
export const REPORT_SECTION_KEYS = [
  "reasonForReferral",
  "sessionOverview",
  "observations",
  "assessmentFindings",
  "functionalReview",
  "interventionsUsed",
  "responseToIntervention",
  "clinicalImpressions",
  "recommendations",
  "goals",
  "homeProgramme",
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number];

/** Human-readable titles, kept here so PDF / DOCX / email stay in sync. */
export const REPORT_SECTION_TITLES: Record<ReportSectionKey, string> = {
  reasonForReferral: "Reason for Referral",
  sessionOverview: "Session Overview",
  observations: "Observations and Behaviours",
  assessmentFindings: "Assessment Findings",
  functionalReview: "Functional Review",
  interventionsUsed: "Interventions Used",
  responseToIntervention: "Response to Intervention",
  clinicalImpressions: "Clinical Impressions and Summary",
  recommendations: "Recommendations",
  goals: "Goals and Next Steps",
  homeProgramme: "Home Programme Suggestions",
};

/**
 * Resolve the final section order for a report:
 *   1. Start with whatever the therapist saved.
 *   2. Drop unknown keys (defensive against schema drift).
 *   3. Append any canonical keys the saved order is missing (so a
 *      newly-added section appears automatically on older reports).
 */
export function resolveSectionOrder(
  saved: ReportSectionKey[] | undefined,
): ReportSectionKey[] {
  const valid = new Set<ReportSectionKey>(REPORT_SECTION_KEYS);
  const seen = new Set<ReportSectionKey>();
  const out: ReportSectionKey[] = [];
  for (const k of saved ?? []) {
    if (valid.has(k) && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  for (const k of REPORT_SECTION_KEYS) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
