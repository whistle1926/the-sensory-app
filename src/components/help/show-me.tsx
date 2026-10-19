"use client";

/**
 * "Show me" spotlight — opened from a ticket's "How to check this update"
 * guide (Paddy, Oct 2026: show Grace and Claire exactly where an update is
 * and how to use it).
 *
 * Any portal page opened with `?show=<data-help key>&tip=<text>` rings the
 * element marked `data-help="<key>"` (same pulsing ring as the page "?"
 * help), scrolls it into view, and pins a short tip beside it with a
 * "Got it" button. The element can take a few seconds to appear (pages load
 * their data client-side), so we keep looking for a while; if it never
 * shows, the tip still appears on its own rather than failing silently.
 */
import { useEffect, useState } from "react";
import { MousePointerClick, X } from "lucide-react";

const KEY_RE = /^[a-z0-9-]{1,60}$/;

interface Spot {
  key: string;
  tip: string;
}

function readSpot(): Spot | null {
  const p = new URLSearchParams(window.location.search);
  const key = p.get("show") ?? "";
  if (!KEY_RE.test(key)) return null;
  return { key, tip: (p.get("tip") ?? "").slice(0, 300) };
}

function clearParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("show");
  url.searchParams.delete("tip");
  window.history.replaceState(null, "", url);
}

export function ShowMe() {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [found, setFound] = useState(false);

  // Read the request once on load (and on client navigations that change
  // the query string).
  useEffect(() => {
    const check = () => setSpot(readSpot());
    const first = window.setTimeout(check, 0);
    window.addEventListener("popstate", check);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("popstate", check);
    };
  }, []);

  useEffect(() => {
    if (!spot) return;
    let el: Element | null = null;
    let tries = 0;
    const place = () => el && setBox(el.getBoundingClientRect());
    const timer = window.setInterval(() => {
      tries++;
      el = document.querySelector(`[data-help="${spot.key}"]`);
      if (el) {
        window.clearInterval(timer);
        el.classList.add("help-highlight");
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setFound(true);
        place();
        window.setTimeout(place, 600); // after the smooth scroll settles
      } else if (tries > 40) {
        window.clearInterval(timer); // ~10s: show the tip on its own
      }
    }, 250);
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
      el?.classList.remove("help-highlight");
    };
  }, [spot]);

  if (!spot) return null;

  function dismiss() {
    document
      .querySelectorAll(".help-highlight")
      .forEach((n) => n.classList.remove("help-highlight"));
    clearParams();
    setSpot(null);
    setBox(null);
    setFound(false);
  }

  // Beside the element when we have it (below, or above if there's no
  // room); otherwise a banner at the top of the page.
  const width = 320;
  let style: React.CSSProperties = { top: 88, left: "50%", transform: "translateX(-50%)", width };
  if (found && box) {
    const below = box.bottom + 14;
    const top = below + 160 < window.innerHeight ? below : Math.max(12, box.top - 170);
    const left = Math.min(Math.max(12, box.left), window.innerWidth - width - 12);
    style = { top, left, width };
  }

  return (
    <div
      role="dialog"
      aria-label="Show me"
      className="fixed z-[60] rounded-2xl border-2 border-primary bg-card p-4 text-sm shadow-[var(--shadow-xl)]"
      style={style}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MousePointerClick className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{found ? "It's here" : "Have a look on this page"}</p>
          {spot.tip && <p className="mt-1 leading-relaxed text-muted-foreground">{spot.tip}</p>}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
