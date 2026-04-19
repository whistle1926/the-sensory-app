// Example requireAdmin() guard. Replace with your project's real auth logic.
// The API routes (/api/livekit/{room,recording,participant}) call this to gate
// admin-only actions. Must return { ok: true } or { ok: false, error, status }.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated", status: 401 };

  // Check the user's role. Adapt this to your schema.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "ADMIN") {
    return { ok: false, error: "Admin only", status: 403 };
  }
  return { ok: true, userId: user.id };
}
