// Example client-side auth provider. Replace with your project's real hook.
// The pages expect useAuth() to return { profile, loading } where profile has
// at minimum { id, name, role }.
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface AuthProfile {
  id: string;
  name: string;
  role: "ADMIN" | "HOST" | "VIEWER" | string;
  // Add your own fields here (e.g. host_id, team_id) if you want to
  // filter host/sessions-list to show only the current user's sessions.
}

interface AuthContextValue {
  profile: AuthProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();
      if (!cancelled) {
        setProfile(data ?? null);
        setLoading(false);
      }
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = profile?.role === "ADMIN";

  return (
    <AuthContext.Provider value={{ profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
