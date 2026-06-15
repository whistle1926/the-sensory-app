import { isImageUrl } from "@/lib/home-programme";
import { RichTextView } from "@/components/ui/rich-text-view";

/**
 * Render a programme body for the on-screen preview.
 *
 * New programmes are rich HTML (bold/underline/headings, lists, and
 * demo <img> photos) — rendered via the shared sanitising RichTextView.
 * Legacy programmes stored as PLAIN TEXT fall back to a line renderer
 * that turns image-URL lines into inline photos.
 */
export function ProgrammeBodyView({ body }: { body: string }) {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(body || "");
  if (looksLikeHtml) {
    return <RichTextView html={body} />;
  }
  return (
    <div className="text-sm leading-relaxed text-foreground">
      {(body || "").split("\n").map((raw, i) => {
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
