// Debug: surface any error from DS components / buttonVariants import tree.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LiveSessionsPage() {
  let stage = "start";
  try {
    stage = "auth";
    const session = await auth();
    const email = session?.user?.email ?? "(no session)";

    stage = "prisma";
    const count = await prisma.liveRoom.count();

    stage = "import ds";
    const ds = await import("@/components/ds");
    const dsKeys = Object.keys(ds).join(", ");

    stage = "import button";
    const btn = await import("@/components/ui/button");
    const btnKeys = Object.keys(btn).join(", ");

    stage = "render";
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>Live Sessions — diag step 4.5</h1>
        <p>Session: {email}</p>
        <p>Rooms in DB: {count}</p>
        <p>ds exports: {dsKeys}</p>
        <p>button exports: {btnKeys}</p>
      </div>
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        <h1 style={{ color: "red" }}>Crash at stage: {stage}</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, opacity: 0.7 }}>
          {stack}
        </pre>
      </div>
    );
  }
}
