/**
 * Every key a dashboard template may hold — the ONE list the template
 * editor shows and both template API routes accept.
 *
 * Before this existed the editor and the API kept separate lists that had
 * drifted apart: the editor offered keys (Home Programmes, Calendar, Price
 * list) the API rejected, and templates already held keys (Leaflets, Pages,
 * Forms…) the API wouldn't accept back. Any edit to such a template failed
 * silently — the screen looked saved, nothing was. Keep this in step with
 * the sidebar's navKey values.
 */
export const DASHBOARD_WIDGET_KEYS = [
  "stat_active_clients",
  "stat_total_reports",
  "new_clients",
  "recent_reports",
] as const;

export const NAV_KEYS = [
  "nav_dashboard",
  "nav_clients",
  "nav_website_users",
  "nav_reports",
  "nav_home_programmes",
  "nav_activities",
  "nav_programmes",
  "nav_bookings",
  "nav_calendar",
  "nav_training",
  "nav_recordings",
  "nav_tasks",
  "nav_invoices",
  "nav_free_resources",
  "nav_services",
  "nav_forms",
  "nav_leaflets",
  "nav_pages",
  "nav_live_sessions",
  "nav_team",
  "nav_settings",
] as const;

export const VALID_DASH_KEYS: readonly string[] = [
  ...DASHBOARD_WIDGET_KEYS,
  ...NAV_KEYS,
];

export function isValidDashKeyList(widgets: unknown): widgets is string[] {
  return (
    Array.isArray(widgets) &&
    widgets.every((w) => typeof w === "string" && VALID_DASH_KEYS.includes(w))
  );
}
