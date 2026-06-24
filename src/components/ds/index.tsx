/**
 * Design-system primitives.
 *
 * Tiny composable pieces that match the Dashboard Redesign (V1 Polished)
 * visual language. Pure presentation — no state, no data fetching.
 *
 * These are intentionally minimal wrappers around the `ds-*` classes in
 * `src/app/ds.css`. Use them where it reduces noise; use the raw classes
 * when you need something the component doesn't cover.
 */
import React from "react";
import Link from "next/link";
import { PageHelp } from "@/components/help/page-help";

/* ──────────────────────────────────────────────────────────────────── */
/* Toolbar — page title + subtitle + action strip on the right.        */
/* ──────────────────────────────────────────────────────────────────── */
interface ToolbarProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Page-help registry key. When set, a "?" guide icon is shown next to
   * the title (renders nothing if the key has no registered content). */
  help?: string;
}

export function Toolbar({ title, subtitle, actions, help }: ToolbarProps) {
  return (
    <div className="ds-toolbar">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="ds-page-title">{title}</h1>
          {help && <PageHelp pageKey={help} />}
        </div>
        {subtitle && <p className="ds-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="ds-toolbar-right">{actions}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Panel — card with optional head / body / foot.                      */
/* ──────────────────────────────────────────────────────────────────── */
interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right side of the panel head — filters, "View all" link, etc. */
  actions?: React.ReactNode;
  /** Panel body content. */
  children?: React.ReactNode;
  /** Footer, typically a row count + "Open" link. */
  footer?: React.ReactNode;
  /** Apply internal padding to the body (for non-table content). */
  padded?: boolean;
  /** Extra className for the outer wrapper. */
  className?: string;
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  footer,
  padded,
  className,
}: PanelProps) {
  const showHead = title || subtitle || actions;
  return (
    <div className={`ds-panel ${className ?? ""}`}>
      {showHead && (
        <div className="ds-panel-head">
          <div>
            {title && <h2 className="ds-panel-title">{title}</h2>}
            {subtitle && <p className="ds-panel-sub">{subtitle}</p>}
          </div>
          {actions && <div className="ds-toolbar-right">{actions}</div>}
        </div>
      )}
      <div className={`ds-panel-body ${padded ? "padded" : ""}`}>{children}</div>
      {footer && <div className="ds-panel-foot">{footer}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Chip — status pill with optional dot.                               */
/* ──────────────────────────────────────────────────────────────────── */
export type ChipTone =
  | "neutral"
  | "primary"
  | "success"
  | "warn"
  | "danger"
  | "info";

interface ChipProps {
  tone?: ChipTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function Chip({
  tone = "neutral",
  children,
  dot = true,
  className,
}: ChipProps) {
  return (
    <span className={`ds-chip ds-chip-${tone} ${className ?? ""}`}>
      {dot && <span className="ds-dot" />}
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Segmented control — horizontal tabs with an active state.           */
/* ──────────────────────────────────────────────────────────────────── */
interface SegProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}

export function Seg<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegProps<T>) {
  return (
    <div className={`ds-seg ${className ?? ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "is-active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* LinkBtn — muted "View all →" text link.                             */
/* ──────────────────────────────────────────────────────────────────── */
export function LinkBtn({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="ds-link">
      {children}
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Avatar — initials circle.                                           */
/* ──────────────────────────────────────────────────────────────────── */
interface AvatarProps {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = (name ?? "—")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";
  const sizeClass = size === "md" ? "" : size;
  return (
    <span className={`ds-av ${sizeClass} ${className ?? ""}`}>{initials}</span>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Empty — inline empty state for panel bodies.                        */
/* ──────────────────────────────────────────────────────────────────── */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="ds-empty">{children}</div>;
}
