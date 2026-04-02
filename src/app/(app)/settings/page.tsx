import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-gray-500">Name:</span> Patrick Farren
          </div>
          <div>
            <span className="font-medium text-gray-500">Email:</span> patrick@thesensorysubmarine.com
          </div>
          <div>
            <span className="font-medium text-gray-500">Role:</span> Super Admin
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
