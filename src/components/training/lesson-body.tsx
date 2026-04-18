import { Info, Lightbulb, Sparkles } from "lucide-react";

export interface LessonSection {
  heading?: string;
  body: string;
}

interface Props {
  sections: LessonSection[];
}

/**
 * Lesson body renderer.
 *
 * Takes the simple `{ heading, body }[]` shape and lays it out as readable
 * prose with generous rhythm. If a section heading starts with "Tip:" or
 * "Note:" (case-insensitive) we upgrade the block to a coloured callout.
 *
 * Body text is rendered with `white-space: pre-wrap` so line breaks the
 * author wrote in the source survive. When we have the course builder,
 * this is the renderer target — it already supports the shape admins
 * will author into.
 */
export function LessonBody({ sections }: Props) {
  return (
    <div className="lp-prose">
      {sections.map((s, i) => {
        const heading = (s.heading ?? "").trim();
        const isTip = /^tip[:·]/i.test(heading);
        const isNote = /^note[:·]/i.test(heading);
        const isKey = /^(key takeaways?|summary|remember)[:·]?/i.test(heading);

        if (isTip || isNote || isKey) {
          const label = isTip ? "Tip" : isNote ? "Note" : "Key takeaways";
          const Icon = isTip ? Lightbulb : isKey ? Sparkles : Info;
          const cleanHeading = heading.replace(/^[^:·]+[:·]\s*/, "");
          return (
            <aside key={i} className="lp-callout">
              <p className="callout-label">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </p>
              {cleanHeading && (
                <p className="text-[15px] font-semibold" style={{ margin: 0 }}>
                  {cleanHeading}
                </p>
              )}
              <p
                className="text-[15px]"
                style={{
                  margin: cleanHeading ? "6px 0 0" : 0,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.65,
                }}
              >
                {s.body}
              </p>
            </aside>
          );
        }

        return (
          <section key={i} className="lp-section">
            {heading && <h2>{heading}</h2>}
            <p style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>
          </section>
        );
      })}
    </div>
  );
}
