// Step 2 of the bisect: add auth + session read, skip prisma.
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LiveSessionsPage() {
  let authError: string | null = null;
  let userInfo: string | null = null;
  try {
    const session = await auth();
    if (!session?.user) redirect("/login");
    if (session.user.role === "CLIENT") redirect("/portal");
    userInfo = `${session.user.name ?? "?"} · ${session.user.role}`;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
      throw err; // Let redirects bubble — Next.js uses a special error object.
    }
    authError = err instanceof Error ? `${err.name}: ${err.message}` : "auth error";
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Live Sessions</h1>
      <p>Step 2 — auth + session read.</p>
      <p style={{ marginTop: 12, fontSize: 14 }}>
        {authError ? (
          <span style={{ color: "#b91c1c" }}>AUTH ERROR: {authError}</span>
        ) : (
          <span>Signed in as {userInfo}</span>
        )}
      </p>
    </div>
  );
}
