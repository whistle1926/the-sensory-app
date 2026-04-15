import { redirect } from "next/navigation";
import { isUnlocked } from "@/lib/private-pin";
import { PinUnlockForm } from "@/components/private/pin-unlock-form";
import { Lock } from "lucide-react";

export default async function PrivateUnlockPage() {
  if (await isUnlocked()) redirect("/private");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
      <div className="w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Private area</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your PIN to continue.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <PinUnlockForm />
        </div>
      </div>
    </div>
  );
}
