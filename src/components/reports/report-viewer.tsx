import { ReportContent } from "@/types/report";

interface ReportViewerProps {
  content: ReportContent;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 border-b pb-1 text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function SubSection({ title, text }: { title: string; text: string }) {
  if (!text || text === "Not assessed this session") return null;
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="whitespace-pre-line text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function ReportViewer({ content }: ReportViewerProps) {
  const c = content;

  return (
    <div className="report-content mx-auto max-w-4xl rounded-lg bg-card p-8 shadow print:shadow-none">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Occupational Therapy Session Report
        </h1>
        <p className="text-sm text-muted-foreground">The Sensory Submarine</p>
      </div>

      {/* Client Info Table */}
      <div className="mb-6 overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            {[
              ["Client Name", c.clientInfo.clientName],
              ["Date of Birth", c.clientInfo.dateOfBirth],
              ["Age", c.clientInfo.age],
              ["Date of Session", c.clientInfo.sessionDate],
              ["Session Number", String(c.clientInfo.sessionNumber)],
              ["Referring Clinician", c.clientInfo.referrer],
              ["Diagnosis", c.clientInfo.diagnosis],
              ["Parent/Carer Present", c.clientInfo.parentCarer],
            ].map(([label, value]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="w-1/3 bg-muted px-4 py-2 font-medium text-muted-foreground">
                  {label}
                </td>
                <td className="px-4 py-2 text-foreground">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Reason for Referral">
        <p className="whitespace-pre-line">{c.reasonForReferral}</p>
      </Section>

      <Section title="Session Overview">
        <p className="whitespace-pre-line">{c.sessionOverview}</p>
      </Section>

      <Section title="Observations and Behaviours">
        <SubSection title="Sensory Responses" text={c.observations.sensoryResponses} />
        <SubSection title="Engagement and Participation" text={c.observations.engagementParticipation} />
        <SubSection title="Communication and Social Interaction" text={c.observations.communicationSocial} />
        <SubSection title="Emotional Regulation and Behaviour" text={c.observations.emotionalRegulation} />
      </Section>

      <Section title="Assessment Findings">
        <SubSection title="Sensory Processing" text={c.assessmentFindings.sensoryProcessing} />
        <SubSection title="Fine Motor Skills" text={c.assessmentFindings.fineMotor} />
        <SubSection title="Gross Motor Skills" text={c.assessmentFindings.grossMotor} />
        <SubSection title="Self-Regulation" text={c.assessmentFindings.selfRegulation} />
        <SubSection title="Play and Functional Skills" text={c.assessmentFindings.playFunctional} />
      </Section>

      <Section title="Interventions Used">
        <p className="whitespace-pre-line">{c.interventionsUsed}</p>
      </Section>

      <Section title="Response to Intervention">
        <p className="whitespace-pre-line">{c.responseToIntervention}</p>
      </Section>

      <Section title="Clinical Impressions and Summary">
        <p className="whitespace-pre-line">{c.clinicalImpressions}</p>
      </Section>

      <Section title="Recommendations">
        <p className="whitespace-pre-line">{c.recommendations}</p>
      </Section>

      <Section title="Goals and Next Steps">
        <SubSection title="Short-Term Goals" text={c.goals.shortTerm} />
        <SubSection title="Long-Term Goals" text={c.goals.longTerm} />
        <SubSection title="Next Session Plan" text={c.goals.nextSessionPlan} />
      </Section>

      <Section title="Home Programme Suggestions">
        <p className="whitespace-pre-line">{c.homeProgrammeSuggestions}</p>
      </Section>

      {/* Footer */}
      <div className="mt-8 border-t pt-4 text-sm text-muted-foreground">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium">Report prepared by:</span> {c.therapistName}
          </div>
          <div>
            <span className="font-medium">Qualifications:</span> {c.therapistQualifications}
          </div>
          <div>
            <span className="font-medium">Date of report:</span> {c.reportDate}
          </div>
          <div>
            <span className="font-medium">Review date:</span> {c.reviewDate}
          </div>
        </div>
        <p className="mt-4 text-xs italic text-muted-foreground/60">
          This report is confidential and intended for the named recipient(s) only.
          If you have received this report in error, please contact The Sensory Submarine immediately.
        </p>
      </div>
    </div>
  );
}
