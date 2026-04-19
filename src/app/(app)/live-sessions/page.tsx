// Stripped-to-the-bone diagnostic. If THIS 500s the issue is environmental
// (middleware, layout wrapper, route group). If it renders, the crash is
// somewhere in our auth/prisma/render tree.
export const dynamic = "force-dynamic";

export default function LiveSessionsPage() {
  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Live Sessions</h1>
      <p>Diagnostic render — if you can read this, the route itself is fine.</p>
      <p style={{ marginTop: 20, fontSize: 12, color: "#666" }}>
        Build time: {new Date().toISOString()}
      </p>
    </div>
  );
}
