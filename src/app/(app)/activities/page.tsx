import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function ActivitiesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Activity Bank</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <BookOpen className="h-12 w-12 text-gray-300" />
          <div className="text-center">
            <p className="font-medium text-gray-500">Coming Soon</p>
            <p className="text-sm text-gray-400">
              The activity bank will contain structured sensory activities for use in reports, home programmes, and training content.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
