"use client";

import { Video, Clock, Globe, CreditCard, Calendar, Users } from "lucide-react";

const services = [
  {
    title: "Initial OT Consultation",
    duration: "60 minutes",
    price: "£85",
    description: "Comprehensive initial assessment via video call. Includes discussion of presenting concerns, observation of your child during play, and immediate practical recommendations. Written summary emailed within 48 hours.",
    icon: Video,
  },
  {
    title: "Follow-Up Session",
    duration: "45 minutes",
    price: "£65",
    description: "Review progress, adjust strategies, and address new concerns. Includes updated home programme recommendations. Ideal for families who cannot attend in-person sessions regularly.",
    icon: Clock,
  },
  {
    title: "School Consultation",
    duration: "30 minutes",
    price: "£45",
    description: "Video call with your childs teacher or SENCO to discuss sensory strategies for the classroom. Includes written classroom strategy document. Can be booked alongside a parent session.",
    icon: Users,
  },
  {
    title: "Sensory Eaters Programme — Online",
    duration: "6 x 45-minute sessions",
    price: "£250",
    description: "Structured online programme for parents of children with selective eating. Covers food chaining, mealtime strategies, oral sensory processing, and building positive food relationships. Small group format (max 6 families).",
    icon: Globe,
  },
];

const upcomingSlots = [
  { date: "Monday 7 April 2026", times: ["10:00", "14:00", "16:00"] },
  { date: "Wednesday 9 April 2026", times: ["09:30", "11:00", "15:00"] },
  { date: "Friday 11 April 2026", times: ["10:00", "13:00"] },
  { date: "Monday 14 April 2026", times: ["09:30", "11:00", "14:00", "16:00"] },
];

export default function ConsultationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Online Consultations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Video-based OT consultations for families across the UK and Ireland
        </p>
      </div>

      {/* Services */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Services</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">{s.title}</h3>
                      <span className="text-lg font-bold text-primary">{s.price}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.duration}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Availability */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Availability</h2>
        </div>
        <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="divide-y divide-border">
            {upcomingSlots.map((slot, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-foreground">{slot.date}</span>
                <div className="flex gap-2">
                  {slot.times.map(t => (
                    <span key={t} className="rounded-lg bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-semibold">How Online Consultations Work</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Book", desc: "Choose a service and select a time slot that works for you." },
            { step: "2", title: "Prepare", desc: "You will receive a pre-session questionnaire and a video link via email." },
            { step: "3", title: "Connect", desc: "Join the video call at your appointment time. Written recommendations follow within 48 hours." },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{s.step}</div>
              <h3 className="mt-2 font-semibold text-foreground">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
