/**
 * Minimal iCalendar (RFC 5545) parser — enough for Google Calendar's
 * "Secret iCal URL" output, which is what we accept from each staff
 * member on the Settings page.
 *
 * We deliberately parse only what we render: UID, SUMMARY, DTSTART,
 * DTEND, DESCRIPTION, LOCATION. Recurrence rules, attendees, alarms,
 * VTIMEZONE definitions etc. are ignored. Recurring events expand
 * via Google's server-side rendering of the feed (Google sends each
 * occurrence as a separate VEVENT when the feed is fetched), so we
 * don't need to interpret RRULE ourselves.
 */

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO string — start instant (or start-of-day for all-day events). */
  startAt: string;
  /** ISO string — end instant. */
  endAt: string;
  allDay: boolean;
}

/**
 * Unfold logical lines per RFC 5545 §3.1 — physical lines that begin
 * with a space or tab are continuations of the previous line.
 */
function unfold(raw: string): string[] {
  const physical = raw.split(/\r?\n/);
  const logical: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}

/**
 * Parse a single ICS DATE / DATE-TIME value, honouring an optional
 * `TZID=` parameter on the property. Returns {iso, allDay}.
 *
 * Supported shapes:
 *   20260601                            → date-only, all-day
 *   20260601T103000Z                    → UTC datetime
 *   20260601T103000 (with TZID=Europe/London on the property)
 *                                      → local datetime in the named zone
 *
 * For unknown TZIDs we fall back to treating the value as UTC. This
 * is a small lie for non-UTC personal calendars, but Google's iCal
 * export uses TZID=UTC + Z-suffix for most events anyway.
 */
function parseDateValue(
  raw: string,
  tzid: string | null,
): { iso: string; allDay: boolean } {
  // Strict YYYYMMDD = all-day
  if (/^\d{8}$/.test(raw)) {
    const yyyy = raw.slice(0, 4);
    const mm = raw.slice(4, 6);
    const dd = raw.slice(6, 8);
    return { iso: `${yyyy}-${mm}-${dd}T00:00:00.000Z`, allDay: true };
  }
  // YYYYMMDDTHHMMSS(Z) datetime
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) {
    // Unknown shape — return now so we don't drop the whole event.
    return { iso: new Date().toISOString(), allDay: false };
  }
  const [, y, mo, d, h, mi, s, z] = m;
  if (z === "Z" || !tzid) {
    return {
      iso: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`).toISOString(),
      allDay: false,
    };
  }
  // Has a TZID but no Z — interpret as local-in-that-zone by
  // computing the UTC offset for that zone at that instant.
  try {
    const naive = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
    const utcGuess = new Date(`${naive}Z`); // pretend it's UTC
    const local = new Date(
      utcGuess.toLocaleString("en-US", { timeZone: tzid }),
    );
    const offsetMs = utcGuess.getTime() - local.getTime();
    return {
      iso: new Date(utcGuess.getTime() + offsetMs).toISOString(),
      allDay: false,
    };
  } catch {
    return {
      iso: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`).toISOString(),
      allDay: false,
    };
  }
}

/** Unescape RFC 5545 inline-escape sequences in TEXT values. */
function unescape(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\N/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Parse an ICS feed string into a list of events.
 *
 * Robust to malformed input — we drop events we can't parse rather
 * than throwing, because one bad VEVENT shouldn't kill the whole
 * team-calendar page render.
 */
export function parseIcs(raw: string): IcsEvent[] {
  const lines = unfold(raw);
  const events: IcsEvent[] = [];
  let inEvent = false;
  let cur: Partial<IcsEvent> & { _allDayStart?: boolean } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (cur.uid && cur.title && cur.startAt && cur.endAt) {
        events.push({
          uid: cur.uid,
          title: cur.title,
          description: cur.description,
          location: cur.location,
          startAt: cur.startAt,
          endAt: cur.endAt,
          allDay: !!cur._allDayStart,
        });
      }
      continue;
    }
    if (!inEvent) continue;

    // property[;PARAM=value;...]: value
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const head = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const [name, ...paramParts] = head.split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [k, v] = p.split("=");
      if (k && v) params[k.toUpperCase()] = v;
    }

    switch (name.toUpperCase()) {
      case "UID":
        cur.uid = value;
        break;
      case "SUMMARY":
        cur.title = unescape(value);
        break;
      case "DESCRIPTION":
        cur.description = unescape(value);
        break;
      case "LOCATION":
        cur.location = unescape(value);
        break;
      case "DTSTART": {
        const parsed = parseDateValue(value, params.TZID ?? null);
        cur.startAt = parsed.iso;
        cur._allDayStart = parsed.allDay;
        break;
      }
      case "DTEND": {
        const parsed = parseDateValue(value, params.TZID ?? null);
        cur.endAt = parsed.iso;
        break;
      }
    }
  }

  return events;
}

/**
 * Convenience — fetch an ICS URL and parse it. Used by the team
 * calendar API. Failures (network, bad feed) bubble up as `null` so
 * one broken member doesn't take the rest down.
 */
export async function fetchAndParseIcs(url: string): Promise<IcsEvent[] | null> {
  try {
    const res = await fetch(url, {
      // Re-fetch every page load is fine for ~5 staff; if growth
      // makes this expensive, layer in a 15-min in-memory cache.
      cache: "no-store",
      headers: { Accept: "text/calendar, */*" },
    });
    if (!res.ok) return null;
    const body = await res.text();
    return parseIcs(body);
  } catch {
    return null;
  }
}
