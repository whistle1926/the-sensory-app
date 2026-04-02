import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roleLabel = session.user.role.replace("_", " ").toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-gray-500">Name:</span>{" "}
            {session.user.name}
          </div>
          <div>
            <span className="font-medium text-gray-500">Email:</span>{" "}
            {session.user.email}
          </div>
          <div>
            <span className="font-medium text-gray-500">Role:</span>{" "}
            {roleLabel}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
