"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Thin "create and redirect" page. Lets any surface (the client
 * profile, a deep link) start a new home programme — optionally
 * pre-linked to a child via ?clientId= — without duplicating the
 * create call. Immediately POSTs and forwards into the editor.
 *
 * Sits alongside /home-programmes/[id]; the static "new" segment wins
 * over the dynamic one, so this never collides with a real id.
 */
export default function NewHomeProgrammePage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // Guard against React StrictMode double-invocation creating two rows.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const clientId = searchParams.get("clientId");
    fetch("/api/home-programmes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientId ? { clientId } : {}),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          error?: string;
        };
        if (data.id) {
          window.location.replace(`/home-programmes/${data.id}?edit=1`);
        } else {
          setError(data.error ?? "Could not create the home programme.");
        }
      })
      .catch(() => setError("Could not create the home programme."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-16 text-sm text-muted-foreground">
      {error ? (
        <>
          <p className="text-red-600">{error}</p>
          <a href="/home-programmes" className="text-primary underline">
            Back to Home Programmes
          </a>
        </>
      ) : (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Creating home programme…
        </>
      )}
    </div>
  );
}
