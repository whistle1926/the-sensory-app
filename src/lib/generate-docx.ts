import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  Footer,
  PageNumber,
} from "docx";
import {
  REPORT_SECTION_TITLES,
  resolveSectionOrder,
  type ReportContent,
  type ReportSectionKey,
} from "@/types/report";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

/**
 * Build one body section's paragraphs. The section order itself is
 * driven by the caller against the user's saved sectionOrder.
 * Style helpers (heading, subheading, multiLineText) are threaded
 * in so they pick up the typography defined in the main builder.
 */
function sectionParas(
  c: ReportContent,
  key: ReportSectionKey,
  heading: (t: string) => Paragraph,
  subheading: (t: string) => Paragraph,
  multiLineText: (t: string) => Paragraph[],
): Paragraph[] {
  switch (key) {
    case "reasonForReferral":
      return [heading(REPORT_SECTION_TITLES.reasonForReferral), ...multiLineText(c.reasonForReferral)];
    case "sessionOverview":
      return [heading(REPORT_SECTION_TITLES.sessionOverview), ...multiLineText(c.sessionOverview)];
    case "observations":
      return [
        heading(REPORT_SECTION_TITLES.observations),
        subheading("Sensory Responses"), ...multiLineText(c.observations.sensoryResponses),
        subheading("Engagement and Participation"), ...multiLineText(c.observations.engagementParticipation),
        subheading("Communication and Social Interaction"), ...multiLineText(c.observations.communicationSocial),
        subheading("Emotional Regulation and Behaviour"), ...multiLineText(c.observations.emotionalRegulation),
      ];
    case "assessmentFindings":
      return [
        heading(REPORT_SECTION_TITLES.assessmentFindings),
        subheading("Sensory Processing"), ...multiLineText(c.assessmentFindings.sensoryProcessing),
        subheading("Fine Motor Skills"), ...multiLineText(c.assessmentFindings.fineMotor),
        subheading("Gross Motor Skills"), ...multiLineText(c.assessmentFindings.grossMotor),
        subheading("Self-Regulation"), ...multiLineText(c.assessmentFindings.selfRegulation),
        subheading("Play and Functional Skills"), ...multiLineText(c.assessmentFindings.playFunctional),
      ];
    case "functionalReview":
      return functionalReviewParas(c, heading, subheading, multiLineText);
    case "interventionsUsed":
      return [heading(REPORT_SECTION_TITLES.interventionsUsed), ...multiLineText(c.interventionsUsed)];
    case "responseToIntervention":
      return [heading(REPORT_SECTION_TITLES.responseToIntervention), ...multiLineText(c.responseToIntervention)];
    case "clinicalImpressions":
      return [heading(REPORT_SECTION_TITLES.clinicalImpressions), ...multiLineText(c.clinicalImpressions)];
    case "recommendations":
      return [heading(REPORT_SECTION_TITLES.recommendations), ...multiLineText(c.recommendations)];
    case "goals":
      return [
        heading(REPORT_SECTION_TITLES.goals),
        subheading("Short-Term Goals"), ...multiLineText(c.goals.shortTerm),
        subheading("Long-Term Goals"), ...multiLineText(c.goals.longTerm),
        subheading("Next Session Plan"), ...multiLineText(c.goals.nextSessionPlan),
      ];
    case "homeProgramme":
      return [heading(REPORT_SECTION_TITLES.homeProgramme), ...multiLineText(c.homeProgrammeSuggestions)];
    default:
      return [];
  }
}

/**
 * Build the Functional Review section's paragraphs. Empty subsections
 * are skipped; the whole heading is suppressed if everything is blank.
 * Heading/subheading/multiLineText helpers are passed in to match the
 * styles defined inside the main builder closure.
 */
function functionalReviewParas(
  c: ReportContent,
  heading: (t: string) => Paragraph,
  subheading: (t: string) => Paragraph,
  multiLineText: (t: string) => Paragraph[],
): Paragraph[] {
  const fr = c.functionalReview;
  if (!fr) return [];
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
  if (filled.length === 0) return [];
  const out: Paragraph[] = [heading("Functional Review")];
  for (const [label, value] of filled) {
    out.push(subheading(label), ...multiLineText(value as string));
  }
  return out;
}

function infoRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 3200, type: WidthType.DXA },
        shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial" })] })],
      }),
      new TableCell({
        borders,
        width: { size: 6160, type: WidthType.DXA },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: "Arial" })] })],
      }),
    ],
  });
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial" })],
  });
}

function subheading(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, font: "Arial" })],
  });
}

function bodyText(text: string) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 20, font: "Arial" })],
  });
}

function multiLineText(text: string): Paragraph[] {
  return text.split("\n").filter(Boolean).map((line) => bodyText(line.trim()));
}

export async function generateDocx(content: ReportContent): Promise<Buffer> {
  const c = content;

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 16, font: "Arial" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial" }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: "Occupational Therapy Session Report", bold: true, size: 32, font: "Arial" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: "The Sensory Submarine", size: 22, font: "Arial", color: "666666" })],
          }),

          // Client Info Table
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3200, 6160],
            rows: [
              infoRow("Client Name", c.clientInfo.clientName),
              infoRow("Date of Birth", c.clientInfo.dateOfBirth),
              infoRow("Age", c.clientInfo.age),
              infoRow("Date of Session", c.clientInfo.sessionDate),
              infoRow("Session Number", String(c.clientInfo.sessionNumber)),
              infoRow("Referring Clinician", c.clientInfo.referrer),
              infoRow("Diagnosis", c.clientInfo.diagnosis),
              infoRow("Parent/Carer Present", c.clientInfo.parentCarer),
            ],
          }),

          // Body sections — order follows the therapist's saved
          // sectionOrder (with canonical fallback for older reports
          // that don't have one). All sections including Reason
          // for Referral + Session Overview are part of the
          // reorderable set.
          ...resolveSectionOrder(c.sectionOrder).flatMap((k) =>
            sectionParas(c, k, heading, subheading, multiLineText),
          ),

          // Footer info
          new Paragraph({ spacing: { before: 400 }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 8 } }, children: [] }),
          bodyText(`Report prepared by: ${c.therapistName}`),
          bodyText(`Qualifications: ${c.therapistQualifications}`),
          bodyText(`Date of report: ${c.reportDate}`),
          bodyText(`Review date: ${c.reviewDate}`),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: "This report is confidential and intended for the named recipient(s) only. If you have received this report in error, please contact The Sensory Submarine immediately.",
                size: 16,
                font: "Arial",
                italics: true,
                color: "999999",
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
