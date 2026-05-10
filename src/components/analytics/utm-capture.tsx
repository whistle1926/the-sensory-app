"use client";

/**
 * Mounts once at the root of the document. On first load it reads the
 * URL's UTM / gclid / fbclid params and stores them in sessionStorage
 * via `storeUtms()`. Renders nothing — pure side effect.
 *
 * Lives at the layout level so the capture happens regardless of which
 * page the ad sends the visitor to (`/courses`, `/`, `/lp/...`, etc.).
 */
import { useEffect } from "react";
import { parseUtms, storeUtms } from "@/lib/utm";

export function UtmCapture() {
  useEffect(() => {
    const utms = parseUtms(window.location.search);
    storeUtms(utms);
  }, []);
  return null;
}
