"use client";

// No global header — the viewer page renders its own per-session branded
// header so admins can override the title/logo on a per-room basis.
export default function LiveViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">{children}</main>
    </div>
  );
}
