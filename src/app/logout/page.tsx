"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

export default function LogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <div className="sub flex min-h-screen items-center justify-center px-5">
      <div className="sub-edge-xl w-full max-w-sm rounded-[26px] bg-white p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#6B7794]" />
        <p className="sub-display mt-4 text-2xl">Signing out…</p>
        <p className="mt-1 text-sm font-semibold text-[#6B7794]">
          See you next time.
        </p>
      </div>
    </div>
  );
}
