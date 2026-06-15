import { isImageUrl } from "@/lib/home-programme";

/**
 * Render a plain-text programme body, turning demo-step image-URL lines
 * into inline photos. Shared by the standalone Home Programme view and
 * the report's home-programme section so both preview exactly what the
 * parent receives in the PDF/email.
 */
export function ProgrammeBodyView({ body }: { body: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground">
      {body.split("\n").map((raw, i) => {
        const t = raw.trim();
        if (isImageUrl(t)) {
          // eslint-disable-next-line @next/next/no-img-element
          return (
            <img
              key={i}
              src={t}
              alt="Demo step"
              className="my-2 max-w-xs rounded-lg border border-border"
            />
          );
        }
        if (!t) return <div key={i} className="h-2" aria-hidden />;
        return (
          <p key={i} className="whitespace-pre-wrap">
            {raw}
          </p>
        );
      })}
    </div>
  );
}
