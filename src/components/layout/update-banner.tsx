"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, X } from "lucide-react";

// How often to quietly check whether a newer version has been deployed.
// Also checked whenever the tab regains focus, so an idle tab picks it
// up the moment the user returns.
const POLL_MS = 2 * 60 * 1000;

/**
 * Watches for new deployments and shows a refresh prompt.
 *
 * The build id baked into THIS bundle (NEXT_PUBLIC_BUILD_ID) is fixed
 * for the life of the loaded page. /api/version reports the build id of
 * the live deployment. When they diverge, a new version has shipped and
 * we invite the user to refresh to pick it up (their unsaved local work
 * — e.g. report-edit drafts — is preserved in localStorage either way).
 */
export function UpdateBanner() {
  const loadedVersion = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  // Remember a version the user explicitly dismissed so we don't nag for
  // the same release; a yet-newer deploy will still surface.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const pathname = usePathname();

  const checkVersion = useCallback(async () => {
    // No meaningful version locally — nothing to compare against.
    if (loadedVersion === "dev") return;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data?.version && data.version !== "dev") {
        setLatestVersion(data.version);
      }
    } catch {
      // Offline / transient — ignore; we'll try again on the next tick.
    }
  }, [loadedVersion]);

  // Keep a stable ref so the focus/visibility listeners always call the
  // latest checker without re-subscribing.
  const checkRef = useRef(checkVersion);
  checkRef.current = checkVersion;

  useEffect(() => {
    if (loadedVersion === "dev") return;

    // Initial check shortly after load, then on an interval.
    const first = setTimeout(() => checkRef.current(), 5_000);
    const interval = setInterval(() => checkRef.current(), POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") checkRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [loadedVersion]);

  // A newer build exists than the one this tab is running.
  const newVersionExists =
    latestVersion !== null && latestVersion !== loadedVersion;

  // Silently full-reload at the next safe boundary — a route change — so
  // non-technical users get the new code without knowing what "refresh"
  // means. Navigation is a safe point: they're leaving the page anyway,
  // and in-progress work (report drafts, edits) is preserved in
  // localStorage. This runs even if the banner was dismissed, since a
  // reload-on-navigation is seamless and never interrupts active typing.
  const armedPath = useRef<string | null>(null);
  useEffect(() => {
    if (!newVersionExists) {
      armedPath.current = null;
      return;
    }
    if (armedPath.current === null) {
      armedPath.current = pathname; // arm on the page where we noticed
      return;
    }
    if (pathname !== armedPath.current) {
      window.location.reload(); // they navigated → load fresh code
    }
  }, [newVersionExists, pathname]);

  // Show the banner unless this exact release was dismissed.
  const showBanner = newVersionExists && latestVersion !== dismissed;
  if (!showBanner) return null;

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground shadow">
        <span className="inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          An update is ready — it will apply automatically as you move
          around, or update now.
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary-foreground px-3 py-1 text-xs font-semibold text-primary transition hover:opacity-90"
        >
          Update now
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(latestVersion)}
          className="rounded-md p-1 text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
