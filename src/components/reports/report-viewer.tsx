"use client";

import { ReportContent } from "@/types/report";
import { HomeProgrammeEditor } from "@/components/reports/home-programme-editor";

interface ReportViewerProps {
  content: ReportContent;
  /**
   * When true, every field becomes editable inline (text inputs for the
   * client-info table, autosizing textareas for the prose sections).
   * `onChange` is called with the updated content on every keystroke —
   * the parent owns the dirty copy and decides when to PATCH.
   */
  editing?: boolean;
  onChange?: (next: ReportContent) => void;
}

/**
 * Sets a single nested field on the content object without mutating it.
 * Path is a dotted string like "observations.sensoryResponses" or just
 * "reasonForReferral" for top-level fields.
 */
function setAtPath(
  obj: ReportContent,
  path: string,
  value: string | number,
): ReportContent {
  const parts = path.split(".");
  // Lightly-typed structural clone — the leaf path is whatever the caller
  // passes (no runtime check). Misuse would surface in a type error in
  // the form below before it reaches this helper.
  const next: ReportContent = JSON.parse(JSON.stringify(obj));
  let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

/**
 * Plain `<textarea>` styled to look like the prose underneath. Grows
 * with content via `rows` heuristic. Used in edit mode for every
 * long-form field.
 */
function ProseTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  // Rough heuristic: enough rows for the existing content + a buffer so
  // the textarea doesn't feel cramped while typing.
  const rows = Math.max(3, value.split("\n").length + 1);
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="mb-6 scroll-mt-20">
      <h2 className="mb-2 border-b pb-1 text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function SubSection({
  title,
  text,
  editing,
  onChange,
}: {
  title: string;
  text: string;
  editing: boolean;
  onChange?: (next: string) => void;
}) {
  // In view mode, skip rendering empty / "not assessed" sub-sections so
  // the printed report stays tidy. In edit mode we always show them so
  // the therapist can fill them in.
  if (!editing && (!text || text === "Not assessed this session")) return null;
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {editing ? (
        <ProseTextarea value={text} onChange={(v) => onChange?.(v)} />
      ) : (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}

/**
 * A single prose section field (`reasonForReferral`, `sessionOverview`,
 * etc.). Toggles between a `<p>` and a textarea on `editing`.
 */
function Prose({
  value,
  editing,
  onChange,
}: {
  value: string;
  editing: boolean;
  onChange?: (next: string) => void;
}) {
  return editing ? (
    <ProseTextarea value={value} onChange={(v) => onChange?.(v)} />
  ) : (
    <p className="whitespace-pre-line">{value}</p>
  );
}

export function ReportViewer({ content, editing = false, onChange }: ReportViewerProps) {
  const c = content;

  // Curry the per-field setter so each row stays readable below.
  const set = (path: string) => (v: string | number) => {
    if (!onChange) return;
    onChange(setAtPath(c, path, v));
  };

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
            {([
              ["Client Name", "clientInfo.clientName", c.clientInfo.clientName, "text"],
              ["Date of Birth", "clientInfo.dateOfBirth", c.clientInfo.dateOfBirth, "text"],
              ["Age", "clientInfo.age", c.clientInfo.age, "text"],
              ["Date of Session", "clientInfo.sessionDate", c.clientInfo.sessionDate, "text"],
              ["Session Number", "clientInfo.sessionNumber", String(c.clientInfo.sessionNumber), "number"],
              ["Referring Clinician", "clientInfo.referrer", c.clientInfo.referrer, "text"],
              ["Diagnosis", "clientInfo.diagnosis", c.clientInfo.diagnosis, "text"],
              ["Parent/Carer Present", "clientInfo.parentCarer", c.clientInfo.parentCarer, "text"],
            ] as const).map(([label, path, value, kind]) => (
              <tr key={path} className="border-b last:border-0">
                <td className="w-1/3 bg-muted px-4 py-2 font-medium text-muted-foreground">
                  {label}
                </td>
                <td className="px-4 py-2 text-foreground">
                  {editing ? (
                    <input
                      type={kind}
                      value={value}
                      onChange={(e) =>
                        set(path)(
                          kind === "number" ? Number(e.target.value) || 0 : e.target.value,
                        )
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  ) : (
                    value
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Reason for Referral">
        <Prose value={c.reasonForReferral} editing={editing} onChange={set("reasonForReferral")} />
      </Section>

      <Section title="Session Overview">
        <Prose value={c.sessionOverview} editing={editing} onChange={set("sessionOverview")} />
      </Section>

      <Section title="Observations and Behaviours">
        <SubSection title="Sensory Responses" text={c.observations.sensoryResponses} editing={editing} onChange={set("observations.sensoryResponses")} />
        <SubSection title="Engagement and Participation" text={c.observations.engagementParticipation} editing={editing} onChange={set("observations.engagementParticipation")} />
        <SubSection title="Communication and Social Interaction" text={c.observations.communicationSocial} editing={editing} onChange={set("observations.communicationSocial")} />
        <SubSection title="Emotional Regulation and Behaviour" text={c.observations.emotionalRegulation} editing={editing} onChange={set("observations.emotionalRegulation")} />
      </Section>

      <Section title="Assessment Findings">
        <SubSection title="Sensory Processing" text={c.assessmentFindings.sensoryProcessing} editing={editing} onChange={set("assessmentFindings.sensoryProcessing")} />
        <SubSection title="Fine Motor Skills" text={c.assessmentFindings.fineMotor} editing={editing} onChange={set("assessmentFindings.fineMotor")} />
        <SubSection title="Gross Motor Skills" text={c.assessmentFindings.grossMotor} editing={editing} onChange={set("assessmentFindings.grossMotor")} />
        <SubSection title="Self-Regulation" text={c.assessmentFindings.selfRegulation} editing={editing} onChange={set("assessmentFindings.selfRegulation")} />
        <SubSection title="Play and Functional Skills" text={c.assessmentFindings.playFunctional} editing={editing} onChange={set("assessmentFindings.playFunctional")} />
      </Section>

      <Section title="Interventions Used">
        <Prose value={c.interventionsUsed} editing={editing} onChange={set("interventionsUsed")} />
      </Section>

      <Section title="Response to Intervention">
        <Prose value={c.responseToIntervention} editing={editing} onChange={set("responseToIntervention")} />
      </Section>

      <Section title="Clinical Impressions and Summary">
        <Prose value={c.clinicalImpressions} editing={editing} onChange={set("clinicalImpressions")} />
      </Section>

      <Section title="Recommendations">
        <Prose value={c.recommendations} editing={editing} onChange={set("recommendations")} />
      </Section>

      <Section title="Goals and Next Steps">
        <SubSection title="Short-Term Goals" text={c.goals.shortTerm} editing={editing} onChange={set("goals.shortTerm")} />
        <SubSection title="Long-Term Goals" text={c.goals.longTerm} editing={editing} onChange={set("goals.longTerm")} />
        <SubSection title="Next Session Plan" text={c.goals.nextSessionPlan} editing={editing} onChange={set("goals.nextSessionPlan")} />
      </Section>

      <Section title="Home Programme Suggestions" id="home-programme">
        {editing ? (
          // Custom editor with Insert template / Insert activity
          // pickers above the textarea, so Patrick can drop a
          // pre-built programme or activity into the field and then
          // personalise it for the client.
          <HomeProgrammeEditor
            value={c.homeProgrammeSuggestions}
            onChange={(v) => set("homeProgrammeSuggestions")(v)}
          />
        ) : (
          <Prose value={c.homeProgrammeSuggestions} editing={false} />
        )}
      </Section>

      {/* Footer — therapist details + dates. Editable in edit mode. */}
      <div className="mt-8 border-t pt-4 text-sm text-muted-foreground">
        <div className="grid grid-cols-2 gap-3">
          {([
            ["Report prepared by", "therapistName", c.therapistName],
            ["Qualifications", "therapistQualifications", c.therapistQualifications],
            ["Date of report", "reportDate", c.reportDate],
            ["Review date", "reviewDate", c.reviewDate],
          ] as const).map(([label, path, value]) => (
            <div key={path}>
              <span className="font-medium">{label}:</span>{" "}
              {editing ? (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(path)(e.target.value)}
                  className="rounded border border-input bg-background px-2 py-0.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                value
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs italic text-muted-foreground/60">
          This report is confidential and intended for the named recipient(s) only.
          If you have received this report in error, please contact The Sensory Submarine immediately.
        </p>
      </div>
    </div>
  );
}
