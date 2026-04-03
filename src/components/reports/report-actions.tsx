"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer, Check, Mail } from "lucide-react";
import { useState } from "react";

interface ReportActionsProps {
  reportId: string;
  status: string;
  onStatusChange?: (newStatus: string) => void;
  onEmailClick?: () => void;
}

export function ReportActions({ reportId, status, onStatusChange, onEmailClick }: ReportActionsProps) {
  const [finalising, setFinalising] = useState(false);

  async function handleDownload(format: "docx" | "pdf") {
    const res = await fetch(`/api/reports/${reportId}/${format}`);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
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
      {onEmailClick && (
        <Button variant="outline" size="sm" onClick={onEmailClick}>
          <Mail className="mr-2 h-4 w-4" />
          Email
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => handleDownload("docx")}>
        <Download className="mr-2 h-4 w-4" />
        Word
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleDownload("pdf")}>
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
