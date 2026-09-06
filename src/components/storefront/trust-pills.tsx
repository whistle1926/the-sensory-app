/**
 * The four things Grace wants said about the portal, everywhere the
 * storefront introduces itself: home hero, courses hero, and the navy
 * panel beside sign-in / create-account.
 *
 * They replaced "CPD accredited" / "CPD hours for practitioners" — not
 * every course is CPD accredited, so that line over-promised. One list
 * here so the four never drift apart between pages.
 */
export const TRUST_POINTS = [
  "Paediatric OT led",
  "Evidence based",
  "Self paced",
  "Practical ideas to implement right away",
] as const;

const LIGHT = [
  { border: "#C2E7E3", bg: "#E7F6F4", dot: "#17B0A7" },
  { border: "#F3DFA6", bg: "#FFF3D2", dot: "#FFC93C" },
  { border: "#FBC7D7", bg: "#FFE7EE", dot: "#E71D57" },
  { border: "#C9D2EA", bg: "#EEF1FA", dot: "#12235B" },
];

export function TrustPills({
  tone = "light",
  className = "",
}: {
  /** `light` sits on cream; `dark` sits on the navy panel. */
  tone?: "light" | "dark";
  className?: string;
}) {
  if (tone === "dark") {
    return (
      <div className={`flex flex-wrap gap-2.5 ${className}`}>
        {TRUST_POINTS.map((point) => (
          <span
            key={point}
            className="rounded-full bg-[rgba(255,255,255,.12)] px-3.5 py-2 text-[13px] font-bold text-white"
          >
            {point}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      {TRUST_POINTS.map((point, i) => {
        const c = LIGHT[i % LIGHT.length];
        return (
          <span
            key={point}
            className="inline-flex items-center gap-2.5 rounded-full border-2 px-4 py-2.5 text-sm font-bold"
            style={{ borderColor: c.border, background: c.bg }}
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: c.dot }}
              aria-hidden
            />
            {point}
          </span>
        );
      })}
    </div>
  );
}
