"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  diagnosis: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(data => {
      setClients(Array.isArray(data) ? data : []);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <Link href="/clients/new" className={buttonVariants({ className: "rounded-xl bg-[oklch(0.637_0.237_25.331)] hover:bg-[oklch(0.57_0.237_25.331)]" })}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-10 text-center shadow-sm">
          <p className="text-[oklch(0.5_0.01_260)]">No clients yet. Add your first client to get started.</p>
          <Link href="/clients/new" className={buttonVariants({ className: "mt-4 rounded-xl bg-[oklch(0.637_0.237_25.331)] hover:bg-[oklch(0.57_0.237_25.331)]" })}>
            Add Client
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <div className="group rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm transition-all hover:border-[oklch(0.637_0.237_25.331)]/30 hover:shadow-md">
                <p className="font-semibold text-[oklch(0.17_0.015_280)]">{c.firstName} {c.lastName}</p>
                <p className="mt-1 text-sm text-[oklch(0.5_0.01_260)]">{c.diagnosis || "No diagnosis listed"}</p>
                <p className="mt-2 text-xs text-[oklch(0.6_0.01_260)]">DOB: {new Date(c.dateOfBirth).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
