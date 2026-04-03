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
        <Link href="/clients/new" className={buttonVariants({ className: "rounded-xl bg-primary hover:bg-primary/80" })}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-muted-foreground">No clients yet. Add your first client to get started.</p>
          <Link href="/clients/new" className={buttonVariants({ className: "mt-4 rounded-xl bg-primary hover:bg-primary/80" })}>
            Add Client
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <p className="font-semibold text-foreground">{c.firstName} {c.lastName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.diagnosis || "No diagnosis listed"}</p>
                <p className="mt-2 text-xs text-muted-foreground">DOB: {new Date(c.dateOfBirth).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
