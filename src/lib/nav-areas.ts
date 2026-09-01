/**
 * Maps app areas (page + matching API prefixes) to the nav permission key
 * that grants access to them. Used to ENFORCE access server-side: a staff
 * user whose dashboard template doesn't include the key is blocked from
 * that area — not just hidden from the sidebar.
 *
 * Pure / no imports so it's safe to use in edge middleware. The order
 * matters: longer / more specific prefixes first.
 */
const AREA_NAV: ReadonlyArray<readonly [string, string]> = [
  ["/clients", "nav_clients"],
  ["/api/clients", "nav_clients"],
  ["/reports", "nav_reports"],
  ["/api/reports", "nav_reports"],
  // Letters live in the Reports section (pages under /reports/letters are
  // already covered by the /reports prefix; the API needs its own line).
  ["/api/letters", "nav_reports"],
  ["/invoices", "nav_invoices"],
  ["/api/invoices", "nav_invoices"],
  ["/api/income", "nav_invoices"],
  ["/website-users", "nav_website_users"],
  ["/api/website-users", "nav_website_users"],
  ["/team", "nav_team"],
  ["/api/users", "nav_team"],
  ["/settings", "nav_settings"],
  // NB: /api/settings/storefront is public (whitelisted before this runs).
  ["/api/settings", "nav_settings"],
  ["/services", "nav_services"],
  ["/api/services", "nav_services"],
  ["/forms", "nav_forms"],
  // NB: /api/forms/public/* is whitelisted before this runs.
  ["/api/forms", "nav_forms"],
  ["/home-programmes", "nav_home_programmes"],
  ["/api/home-programmes", "nav_home_programmes"],
  ["/programmes", "nav_programmes"],
  ["/api/programmes", "nav_programmes"],
  ["/training", "nav_training"],
  ["/api/training", "nav_training"],
  // NB: /api/courses/public + /api/courses/checkout are whitelisted.
  ["/api/courses", "nav_training"],
  // Zoom→Vimeo recordings (course content). Own key because the sidebar
  // dedupes by navKey — sharing nav_training would hide one of the two tabs.
  // Remember to add "nav_recordings" to DashTemplate.widgets in the DB, or
  // templated users won't see it.
  // NB: /api/webhooks/zoom is public (PUBLIC_PREFIXES) — Zoom can't auth.
  ["/recordings", "nav_recordings"],
  ["/api/recordings", "nav_recordings"],
];

/** The nav key required to access `pathname`, or null if the area is
 *  ungated (dashboard, bookings, calendar, tasks, activities, leaflets,
 *  portal, public, etc.). */
export function requiredNavKey(pathname: string): string | null {
  for (const [prefix, key] of AREA_NAV) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return key;
    }
  }
  return null;
}
