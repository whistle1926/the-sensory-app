"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer, Check, Mail } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface ReportActionsProps {
  reportId: string;
  status: string;
  onStatusChange?: (newStatus: string) => void;
  showEmail?: boolean;
}

export function ReportActions({ reportId, status, onStatusChange, showEmail }: ReportActionsProps) {
  const [finalising, setFinalising] = useState(false);

  // Word is a real .docx — download it directly.
  async function handleDownloadDocx() {
    const res = await fetch(`/api/reports/${reportId}/docx`);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // "PDF" opens the branded report in a new tab and auto-triggers the
  // browser's print dialog, where the user picks "Save as PDF". (We don't
  // run headless Chrome, so this is how every PDF export in the app works.)
  function handlePdf() {
    window.open(`/api/reports/${reportId}/pdf`, "_blank", "noopener,noreferrer");
  }

  async function handleFinalise() {
    setFinalising(true);
    const res = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "final" }),
    });
    setFinalising(false);
    if (res.ok) onStatusChange?.("final");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showEmail && (
        <Link href={`/reports/${reportId}/email`}>
          <Button variant="outline" size="sm">
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
        </Link>
      )}
      <Button variant="outline" size="sm" onClick={handleDownloadDocx}>
        <Download className="mr-2 h-4 w-4" />
        Word
      </Button>
      <Button variant="outline" size="sm" onClick={handlePdf}>
        <Download className="mr-2 h-4 w-4" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
      {status === "draft" && (
        <Button size="sm" onClick={handleFinalise} disabled={finalising}>
          <Check className="mr-2 h-4 w-4" />
          {finalising ? "Finalising..." : "Finalise"}
        </Button>
      )}
    </div>
  );
}
