"use client";

import { useEffect, useState } from "react";
import { Home, ClipboardList, Download, ChevronDown, ChevronUp } from "lucide-react";

interface Report {
  id: string;
  reportDate: string;
  status: string;
  content: {
    clientInfo: { clientName: string };
    homeProgrammeSuggestions: string;
    goals: { shortTerm: string; longTerm: string };
    recommendations: string;
  };
  client: { firstName: string; lastName: string };
}

const sampleProgrammes = [
  {
    title: "Sensory Diet Template — Proprioceptive Focus",
    description: "A daily schedule of heavy work and deep pressure activities designed to support children who seek proprioceptive input. Includes morning wake-up routine, school-time strategies, after-school wind-down, and bedtime calm-down.",
    activities: [
      { time: "Morning (before school)", items: ["5 star jumps", "Wall push-ups x10", "Carry school bag to car", "Chewy breakfast (toast, cereal bars)"] },
      { time: "School day", items: ["Wobble cushion at desk", "Movement break every 30 mins", "Carry books for teacher", "Fidget tool during carpet time"] },
      { time: "After school", items: ["Trampoline 10 mins", "Crash pad jumps", "Help carry shopping", "Playdough or therapy putty"] },
      { time: "Bedtime", items: ["Deep pressure massage", "Weighted blanket", "Lazy 8 breathing x5", "Dim lighting 30 mins before bed"] },
    ]
  },
  {
    title: "Tactile Desensitisation Programme",
    description: "A 6-week graded exposure programme for children with tactile defensiveness. Progresses from dry textures to wet textures, tools-first to hands-on. Designed to be done 10 minutes daily at home.",
    activities: [
      { time: "Weeks 1-2 (Dry)", items: ["Rice tray with hidden toys — use spoon first, then hands", "Kinetic sand — build shapes, bury fingers", "Dry pasta sorting — sort by shape", "Feather painting on paper"] },
      { time: "Weeks 3-4 (Damp)", items: ["Damp sand — make prints and shapes", "Water beads — scoop and pour", "Finger painting with gloves, then without", "Wet sponge squeezing games"] },
      { time: "Weeks 5-6 (Wet/Sticky)", items: ["Shaving foam on tray — draw letters", "Slime — stretching and squeezing", "Cooked pasta play — hiding toys inside", "Finger paint directly on hands"] },
    ]
  },
  {
    title: "Auditory Sensitivity Management Plan",
    description: "A structured approach for families managing auditory hypersensitivity. Includes environmental modifications, coping strategies, and a graded exposure framework.",
    activities: [
      { time: "Environmental Strategies", items: ["Noise-cancelling headphones in school bag", "Ear defenders for assemblies and fire drills", "Quiet corner at home for overwhelm", "Soft background music during homework"] },
      { time: "Coping Toolkit", items: ["Deep pressure — shoulder squeezes", "Breathing — square breathing technique", "Fidget tool in pocket", "Safe word to tell adults when overwhelmed"] },
      { time: "Graded Exposure (at home)", items: ["Play recorded target sounds at low volume during play", "Gradually increase volume over weeks", "Practice in real settings with headphones available", "Celebrate successful exposures"] },
    ]
  },
];

export default function ProgrammesPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(0);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports").then(r => r.json()).then((data: Report[]) => {
      setReports(Array.isArray(data) ? data : []);
    });
  }, []);

  const reportsWithProgrammes = reports.filter(
    r => r.content?.homeProgrammeSuggestions && r.content.homeProgrammeSuggestions.length > 0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Home Programmes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured home programmes and templates for parents and carers
        </p>
      </div>

      {/* Programme Templates */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Programme Templates</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">{sampleProgrammes.length}</span>
        </div>
        <div className="space-y-3">
          {sampleProgrammes.map((prog, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
              <button
                onClick={() => setExpandedTemplate(expandedTemplate === i ? null : i)}
                className="flex w-full items-center justify-between p-5 text-left"
              >
                <div>
                  <h3 className="font-semibold text-foreground">{prog.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{prog.description}</p>
                </div>
                {expandedTemplate === i ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
              </button>
              {expandedTemplate === i && (
                <div className="border-t border-border px-5 pb-5 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {prog.activities.map((block, j) => (
                      <div key={j} className="rounded-xl bg-background p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{block.time}</p>
                        <ul className="mt-2 space-y-1.5">
                          {block.items.map((item, k) => (
                            <li key={k} className="flex items-start gap-2 text-sm text-foreground/80">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Client-Specific Programmes */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Home className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Client Programmes from Reports</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">{reportsWithProgrammes.length}</span>
        </div>
        {reportsWithProgrammes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-sm)]">
            <p className="text-muted-foreground">No client programmes yet. Generate a report to create a home programme.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reportsWithProgrammes.map(r => (
              <div key={r.id} className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
                <button
                  onClick={() => setExpandedReport(expandedReport === r.id ? null : r.id)}
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {r.client.firstName} {r.client.lastName}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {new Date(r.reportDate).toLocaleDateString()} — {r.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    {expandedReport === r.id ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </button>
                {expandedReport === r.id && (
                  <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Home Programme</p>
                      <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                        {r.content.homeProgrammeSuggestions}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Goals</p>
                      <div className="mt-2 space-y-2 text-sm text-foreground/80">
                        <p><span className="font-medium">Short-term:</span> {r.content.goals?.shortTerm}</p>
                        <p><span className="font-medium">Long-term:</span> {r.content.goals?.longTerm}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
