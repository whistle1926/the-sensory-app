"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  REPORT_SECTION_TITLES,
  resolveSectionOrder,
  type ReportContent,
  type ReportSectionKey,
} from "@/types/report";
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
    // Older reports may not have newer nested groups (e.g.
    // functionalReview); materialise them on first write so the leaf
    // assignment below doesn't blow up.
    if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== "object") {
      cursor[parts[i]] = {};
    }
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

/**
 * Section wrapper that wires up HTML5 drag-and-drop while in edit
 * mode. Renders identically to <Section> when not draggable, so the
 * read-only / printed / exported view is unaffected by this control.
 */
function DraggableSection({
  sectionKey,
  title,
  position,
  total,
  id,
  draggable,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  collapsible,
  isCollapsed,
  onToggleCollapsed,
  children,
}: {
  sectionKey: ReportSectionKey;
  title: string;
  /** 1-based index in the resolved order — shown next to the drag handle. */
  position: number;
  total: number;
  id?: string;
  draggable: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  collapsible: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
}) {
  if (!draggable) {
    return (
      <Section title={title} id={id}>
        {children}
      </Section>
    );
  }

  return (
    <div
      id={id}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      data-section-key={sectionKey}
      className={`mb-6 rounded-md border border-transparent transition-all ${
        isDragging
          ? "opacity-50 ring-2 ring-primary"
          : isCollapsed
            ? "border-border bg-muted/10 hover:bg-muted/30"
            : "hover:border-border hover:bg-muted/20"
      }`}
    >
      {/* Header — entire row acts as the collapse toggle so the OT
          doesn't have to hunt for a tiny chevron. The drag handle on
          the left stops click-propagation so grabbing it for a drag
          doesn't accidentally also expand/collapse. */}
      <button
        type="button"
        onClick={collapsible ? onToggleCollapsed : undefined}
        className={`flex w-full items-center gap-2 border-b py-1 pl-1 pr-2 text-left ${
          collapsible ? "cursor-pointer" : ""
        } ${isCollapsed ? "border-b-transparent" : ""}`}
      >
        <span
          // Stop drag-start clicks on the grip from also firing the
          // collapse toggle. Pointerdown is enough — the actual drag
          // event still works via the parent's draggable.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab text-muted-foreground/60 transition-colors hover:text-foreground"
          title="Drag to reorder"
          aria-label="Drag handle"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        {/* Numbered badge so the OT can see at a glance which
            position each section is in (and what the total is) */}
        <span
          className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold tabular-nums text-primary"
          title={`Section ${position} of ${total}`}
        >
          {position}
        </span>
        <h2 className="flex-1 pb-1 text-lg font-semibold text-foreground">
          {title}
        </h2>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {position} / {total}
        </span>
        {collapsible && (
          <span
            className="text-muted-foreground/60 transition-transform"
            aria-label={isCollapsed ? "Expand section" : "Collapse section"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}
      </button>
      {!isCollapsed && (
        <div className="text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
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

  /* ───────────── Section ordering ───────────── */
  // Resolved order = saved order ∪ canonical (handles legacy reports
  // and any future keys we add).
  const orderedKeys = useMemo(
    () => resolveSectionOrder(c.sectionOrder),
    [c.sectionOrder],
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  /* ───────────── Collapsed-section state ───────────── */
  // Per-section collapse toggle for edit mode. Patrick wants the
  // editor to open in compact "all collapsed" mode by default so
  // reordering is the immediate, frictionless first action. Lazy
  // init seeds the set once on mount from the resolved order;
  // expanding/collapsing during the session is preserved across
  // re-renders. Empty set = everything expanded.
  const [collapsed, setCollapsed] = useState<Set<ReportSectionKey>>(
    () => new Set(orderedKeys),
  );
  function toggleCollapsed(k: ReportSectionKey) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }
  const allCollapsed = collapsed.size === orderedKeys.length;
  function collapseAll() {
    setCollapsed(new Set(orderedKeys));
  }
  function expandAll() {
    setCollapsed(new Set());
  }

  function handleDragStart(i: number) {
    if (!editing) return;
    setDragIndex(i);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>,
    overIndex: number,
  ) {
    if (!editing) return;
    e.preventDefault();
    if (dragIndex === null || dragIndex === overIndex) return;
    const next = [...orderedKeys];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(overIndex, 0, moved);
    // Persist into content.sectionOrder via the existing onChange
    // plumbing — the parent's draftContent picks it up and the
    // user's eventual Save call writes it to the DB.
    if (onChange) {
      onChange({ ...c, sectionOrder: next });
    }
    setDragIndex(overIndex);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  /**
   * Render the body of a section by key. Returns null when the
   * section is unknown (defensive — shouldn't happen given
   * resolveSectionOrder's whitelist, but keeps render safe).
   */
  function renderSectionBody(key: ReportSectionKey): React.ReactNode {
    switch (key) {
      case "reasonForReferral":
        return (
          <Prose value={c.reasonForReferral} editing={editing} onChange={set("reasonForReferral")} />
        );
      case "sessionOverview":
        return (
          <Prose value={c.sessionOverview} editing={editing} onChange={set("sessionOverview")} />
        );
      case "observations":
        return (
          <>
            <SubSection title="Sensory Responses" text={c.observations.sensoryResponses} editing={editing} onChange={set("observations.sensoryResponses")} />
            <SubSection title="Engagement and Participation" text={c.observations.engagementParticipation} editing={editing} onChange={set("observations.engagementParticipation")} />
            <SubSection title="Communication and Social Interaction" text={c.observations.communicationSocial} editing={editing} onChange={set("observations.communicationSocial")} />
            <SubSection title="Emotional Regulation and Behaviour" text={c.observations.emotionalRegulation} editing={editing} onChange={set("observations.emotionalRegulation")} />
          </>
        );
      case "assessmentFindings":
        return (
          <>
            <SubSection title="Sensory Processing" text={c.assessmentFindings.sensoryProcessing} editing={editing} onChange={set("assessmentFindings.sensoryProcessing")} />
            <SubSection title="Fine Motor Skills" text={c.assessmentFindings.fineMotor} editing={editing} onChange={set("assessmentFindings.fineMotor")} />
            <SubSection title="Gross Motor Skills" text={c.assessmentFindings.grossMotor} editing={editing} onChange={set("assessmentFindings.grossMotor")} />
            <SubSection title="Self-Regulation" text={c.assessmentFindings.selfRegulation} editing={editing} onChange={set("assessmentFindings.selfRegulation")} />
            <SubSection title="Play and Functional Skills" text={c.assessmentFindings.playFunctional} editing={editing} onChange={set("assessmentFindings.playFunctional")} />
          </>
        );
      case "functionalReview":
        return (
          <>
            <SubSection title="Feeding and Eating" text={c.functionalReview?.feedingAndEating ?? ""} editing={editing} onChange={set("functionalReview.feedingAndEating")} />
            <SubSection title="Personal Care and Dressing" text={c.functionalReview?.personalCareAndDressing ?? ""} editing={editing} onChange={set("functionalReview.personalCareAndDressing")} />
            <SubSection title="Toileting" text={c.functionalReview?.toileting ?? ""} editing={editing} onChange={set("functionalReview.toileting")} />
            <SubSection title="Sleep" text={c.functionalReview?.sleep ?? ""} editing={editing} onChange={set("functionalReview.sleep")} />
            <SubSection title="School" text={c.functionalReview?.school ?? ""} editing={editing} onChange={set("functionalReview.school")} />
            <SubSection title="Any Other Concerns" text={c.functionalReview?.otherConcerns ?? ""} editing={editing} onChange={set("functionalReview.otherConcerns")} />
            <SubSection title="Discussion with Parent/Carer" text={c.functionalReview?.discussionWithParent ?? ""} editing={editing} onChange={set("functionalReview.discussionWithParent")} />
          </>
        );
      case "interventionsUsed":
        return <Prose value={c.interventionsUsed} editing={editing} onChange={set("interventionsUsed")} />;
      case "responseToIntervention":
        return <Prose value={c.responseToIntervention} editing={editing} onChange={set("responseToIntervention")} />;
      case "clinicalImpressions":
        return <Prose value={c.clinicalImpressions} editing={editing} onChange={set("clinicalImpressions")} />;
      case "recommendations":
        return <Prose value={c.recommendations} editing={editing} onChange={set("recommendations")} />;
      case "goals":
        return (
          <>
            <SubSection title="Short-Term Goals" text={c.goals.shortTerm} editing={editing} onChange={set("goals.shortTerm")} />
            <SubSection title="Long-Term Goals" text={c.goals.longTerm} editing={editing} onChange={set("goals.longTerm")} />
            <SubSection title="Next Session Plan" text={c.goals.nextSessionPlan} editing={editing} onChange={set("goals.nextSessionPlan")} />
          </>
        );
      case "homeProgramme":
        return editing ? (
          <HomeProgrammeEditor
            value={c.homeProgrammeSuggestions}
            onChange={(v) => set("homeProgrammeSuggestions")(v)}
          />
        ) : (
          <Prose value={c.homeProgrammeSuggestions} editing={false} />
        );
      default:
        return null;
    }
  }

  return (
    <div className="report-content mx-auto max-w-4xl rounded-lg bg-card p-8 shadow print:shadow-none">
      <div className="mb-8 text-center">
        {/* Brand mark above the title — Cara's submarine logo. Capped
            at 160px wide so it stays a header element rather than
            dominating the page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.jpg"
          alt="The Sensory Submarine"
          width={160}
          height={160}
          className="mx-auto mb-3 h-auto w-40"
        />
        <h1 className="text-2xl font-bold text-foreground">
          Occupational Therapy Session Report
        </h1>
        <p className="text-sm text-muted-foreground">The Sensory Submarine</p>
      </div>

      {/* Reorder toolbar — only relevant in edit mode. Lets the OT
          fold every section to just its header for a clean drag-and-drop
          view, or expand back for editing. */}
      {editing && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Tip: <strong>Collapse all</strong> to make reordering easier, then expand the one you want to edit.
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={collapseAll}
              disabled={allCollapsed}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              <ChevronRight className="h-3 w-3" />
              Collapse all
            </button>
            <button
              type="button"
              onClick={expandAll}
              disabled={collapsed.size === 0}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              <ChevronDown className="h-3 w-3" />
              Expand all
            </button>
          </div>
        </div>
      )}

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

      {orderedKeys.map((key, index) => {
        const title = REPORT_SECTION_TITLES[key];
        const body = renderSectionBody(key);
        if (body === null) return null;
        return (
          <DraggableSection
            key={key}
            sectionKey={key}
            title={title}
            position={index + 1}
            total={orderedKeys.length}
            // home-programme anchor is used by the "Edit programme"
            // deep-link from the client page.
            id={key === "homeProgramme" ? "home-programme" : undefined}
            draggable={editing}
            isDragging={dragIndex === index}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            collapsible={editing}
            isCollapsed={collapsed.has(key)}
            onToggleCollapsed={() => toggleCollapsed(key)}
          >
            {body}
          </DraggableSection>
        );
      })}

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
