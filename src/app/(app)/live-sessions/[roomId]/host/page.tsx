"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveRoom } from "@/components/live/live-room";

/**
 * Host studio — full-viewport LiveKit conference with cam/mic on, chat,
 * screen-share, and device selector, all provided by the LiveKit
 * prebuilt VideoConference component.
 */
export default function LiveSessionHostPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  return (
    <div className="space-y-4">
      <Link
        href={`/live-sessions/${roomId}`}
        className="ds-link inline-flex items-center"
        style={{ fontWeight: 500 }}
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Back to session
      </Link>
      <LiveRoom roomId={roomId} role="host" />
    </div>
  );
}
