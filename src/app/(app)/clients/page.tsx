"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
    fetch("/api/clients").then(r => r.json()).then(setClients);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/clients/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500">No clients yet. Add your first client to get started.</p>
            <Link href="/clients/new" className={cn(buttonVariants(), "mt-4")}>Add Client</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="hover:border-gray-300 transition-colors">
                <CardContent className="pt-6">
                  <p className="font-medium">{c.firstName} {c.lastName}</p>
                  <p className="text-sm text-gray-500">{c.diagnosis || "No diagnosis listed"}</p>
                  <p className="text-xs text-gray-400 mt-1">DOB: {new Date(c.dateOfBirth).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
