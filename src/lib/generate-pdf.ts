import {
  REPORT_SECTION_TITLES,
  resolveSectionOrder,
  type ReportContent,
  type ReportSectionKey,
} from "@/types/report";
import { bodyToHtml as homeBodyToHtml } from "@/lib/home-programme";

/**
 * Render a single body section by key. The section order itself is
 * resolved by the caller against the user's saved sectionOrder.
 * Functional Review is suppressed entirely when it has no content
 * (avoid printing an empty heading on older reports).
 */
function sectionHtml(
  c: ReportContent,
  key: ReportSectionKey,
  nl: (s: string) => string,
): string {
  const heading = (label: string) => `<h2>${label}</h2>`;
  switch (key) {
    case "reasonForReferral":
      return `${heading(REPORT_SECTION_TITLES.reasonForReferral)}<p>${nl(c.reasonForReferral)}</p>`;
    case "sessionOverview":
      return `${heading(REPORT_SECTION_TITLES.sessionOverview)}<p>${nl(c.sessionOverview)}</p>`;
    case "observations":
      return `${heading(REPORT_SECTION_TITLES.observations)}
        <h3>Sensory Responses</h3><p>${nl(c.observations.sensoryResponses)}</p>
        <h3>Engagement and Participation</h3><p>${nl(c.observations.engagementParticipation)}</p>
        <h3>Communication and Social Interaction</h3><p>${nl(c.observations.communicationSocial)}</p>
        <h3>Emotional Regulation and Behaviour</h3><p>${nl(c.observations.emotionalRegulation)}</p>`;
    case "assessmentFindings":
      return `${heading(REPORT_SECTION_TITLES.assessmentFindings)}
        <h3>Sensory Processing</h3><p>${nl(c.assessmentFindings.sensoryProcessing)}</p>
        <h3>Fine Motor Skills</h3><p>${nl(c.assessmentFindings.fineMotor)}</p>
        <h3>Gross Motor Skills</h3><p>${nl(c.assessmentFindings.grossMotor)}</p>
        <h3>Self-Regulation</h3><p>${nl(c.assessmentFindings.selfRegulation)}</p>
        <h3>Play and Functional Skills</h3><p>${nl(c.assessmentFindings.playFunctional)}</p>`;
    case "functionalReview":
      return functionalReviewHtml(c, nl);
    case "interventionsUsed":
      return `${heading(REPORT_SECTION_TITLES.interventionsUsed)}<p>${nl(c.interventionsUsed)}</p>`;
    case "responseToIntervention":
      return `${heading(REPORT_SECTION_TITLES.responseToIntervention)}<p>${nl(c.responseToIntervention)}</p>`;
    case "clinicalImpressions":
      return `${heading(REPORT_SECTION_TITLES.clinicalImpressions)}<p>${nl(c.clinicalImpressions)}</p>`;
    case "recommendations":
      return `${heading(REPORT_SECTION_TITLES.recommendations)}<p>${nl(c.recommendations)}</p>`;
    case "goals":
      return `${heading(REPORT_SECTION_TITLES.goals)}
        <h3>Short-Term Goals</h3><p>${nl(c.goals.shortTerm)}</p>
        <h3>Long-Term Goals</h3><p>${nl(c.goals.longTerm)}</p>
        <h3>Next Session Plan</h3><p>${nl(c.goals.nextSessionPlan)}</p>`;
    case "homeProgramme":
      // Photo-aware: demo-step image URLs render as inline <img>, so the
      // step illustrations travel into the printed report too.
      return `${heading(REPORT_SECTION_TITLES.homeProgramme)}<div>${homeBodyToHtml(c.homeProgrammeSuggestions)}</div>`;
    default:
      return "";
  }
}

/**
 * Render the optional Functional Review section. Subsections with no
 * content are skipped so older reports (and partially-filled new
 * reports) print tidily. If every subsection is empty the whole
 * heading is suppressed too.
 */
function functionalReviewHtml(
  c: ReportContent,
  nl: (s: string) => string,
): string {
  const fr = c.functionalReview;
  if (!fr) return "";
  const items: Array<[string, string | undefined]> = [
    ["Feeding and Eating", fr.feedingAndEating],
    ["Personal Care and Dressing", fr.personalCareAndDressing],
    ["Toileting", fr.toileting],
    ["Sleep", fr.sleep],
    ["School", fr.school],
    ["Any Other Concerns", fr.otherConcerns],
    ["Discussion with Parent/Carer", fr.discussionWithParent],
  ];
  const filled = items.filter(([, v]) => v && v.trim().length > 0);
  if (filled.length === 0) return "";
  const rows = filled
    .map(([label, value]) => `<h3>${label}</h3><p>${nl(value as string)}</p>`)
    .join("");
  return `<h2>Functional Review</h2>${rows}`;
}

// Simple HTML-to-PDF approach using the browser's print functionality
// For server-side PDF, we generate a styled HTML string that can be rendered
export function generateReportHtml(content: ReportContent): string {
  const c = content;

  const nl = (text: string) => text.replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>OT Report - ${c.clientInfo.clientName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .brand-logo { display: block; margin: 0 auto 12px; width: 140px; height: auto; }
    h1 { text-align: center; font-size: 18pt; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    h2 { font-size: 13pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
    h3 { font-size: 11pt; margin-top: 12px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
    td.label { background: #f3f4f6; font-weight: bold; width: 35%; }
    .footer { border-top: 1px solid #ccc; margin-top: 30px; padding-top: 12px; font-size: 10pt; }
    .confidential { font-size: 9pt; color: #999; font-style: italic; margin-top: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <img src="/brand/logo.jpg" alt="The Sensory Submarine" class="brand-logo" />
  <h1>Occupational Therapy Session Report</h1>
  <p class="subtitle">The Sensory Submarine</p>

  <table>
    <tr><td class="label">Client Name</td><td>${c.clientInfo.clientName}</td></tr>
    <tr><td class="label">Date of Birth</td><td>${c.clientInfo.dateOfBirth}</td></tr>
    <tr><td class="label">Age</td><td>${c.clientInfo.age}</td></tr>
    <tr><td class="label">Date of Session</td><td>${c.clientInfo.sessionDate}</td></tr>
    <tr><td class="label">Session Number</td><td>${c.clientInfo.sessionNumber}</td></tr>
    <tr><td class="label">Referring Clinician</td><td>${c.clientInfo.referrer}</td></tr>
    <tr><td class="label">Diagnosis</td><td>${c.clientInfo.diagnosis}</td></tr>
    <tr><td class="label">Parent/Carer Present</td><td>${c.clientInfo.parentCarer}</td></tr>
  </table>

  ${resolveSectionOrder(c.sectionOrder).map((k) => sectionHtml(c, k, nl)).join("\n")}

  <div class="footer">
    <p><strong>Report prepared by:</strong> ${c.therapistName}</p>
    <p><strong>Qualifications:</strong> ${c.therapistQualifications}</p>
    <p><strong>Date of report:</strong> ${c.reportDate}</p>
    <p><strong>Review date:</strong> ${c.reviewDate}</p>
    <p class="confidential">This report is confidential and intended for the named recipient(s) only. If you have received this report in error, please contact The Sensory Submarine immediately.</p>
  </div>
</body>
</html>`;
}
