"use client";

import { GraduationCap, Clock, Users, Award, BookOpen, Play } from "lucide-react";

const courses = [
  {
    title: "Sensory Processing in the Classroom",
    audience: "Teachers & SNAs",
    duration: "3 hours (self-paced)",
    modules: 6,
    status: "available",
    description: "Understand how sensory processing differences affect learning and behaviour. Practical classroom strategies for supporting children with sensory needs. Includes video demonstrations, downloadable resources, and a certificate of completion.",
    topics: ["What is sensory processing?", "The 8 sensory systems explained", "Identifying sensory seeking and avoiding behaviours", "Classroom accommodations that work", "Creating a sensory-friendly classroom", "When to refer to OT"],
  },
  {
    title: "Introduction to Sensory Play for Early Years",
    audience: "Early Years Practitioners",
    duration: "2 hours (self-paced)",
    modules: 4,
    status: "available",
    description: "How to design and deliver sensory play activities that support child development. Covers messy play, proprioceptive activities, and sensory circuits. Aligned to the Early Years curriculum.",
    topics: ["Why sensory play matters", "Setting up sensory play stations", "Adapting activities for different needs", "Sensory play and the EYFS framework"],
  },
  {
    title: "Supporting Sensory Eaters — For Parents",
    audience: "Parents & Carers",
    duration: "4 hours (self-paced)",
    modules: 8,
    status: "available",
    description: "A comprehensive course for parents of children with selective or restrictive eating. Learn the sensory basis of food refusal, food chaining techniques, and how to create positive mealtimes. Developed with the Sensory Eaters Programme.",
    topics: ["Understanding selective eating", "Oral sensory processing explained", "The food hierarchy — from tolerance to tasting", "Food chaining — step-by-step guide", "Mealtime environment and routine", "Managing anxiety around food", "Working with your childs school", "When to seek professional help"],
  },
  {
    title: "Sensory Regulation Strategies for Schools",
    audience: "Whole School Staff",
    duration: "5 hours (self-paced + live Q&A)",
    modules: 10,
    status: "coming_soon",
    description: "A whole-school approach to sensory regulation. Includes the Zones of Regulation framework, sensory circuits, and how to create a sensory policy. Designed for delivery as a staff INSET day or self-paced online learning.",
    topics: ["Arousal levels and learning readiness", "The Zones of Regulation framework", "Designing a sensory circuit", "Sensory breaks vs movement breaks", "Individual sensory diets", "Whole-class regulation strategies", "Working with parents", "Creating a school sensory policy", "Case studies", "Live Q&A with OT"],
  },
  {
    title: "CPD: Sensory Integration for Allied Health Professionals",
    audience: "OTs, SLTs, Physiotherapists",
    duration: "6 hours (CPD-accredited)",
    modules: 12,
    status: "coming_soon",
    description: "Advanced course on sensory integration theory and practice. Covers assessment, intervention planning, and outcome measurement. CPD-accredited through the Royal College of Occupational Therapists.",
    topics: ["Ayres Sensory Integration theory", "Neurological basis of sensory processing", "Standardised assessment tools", "Clinical reasoning in SI", "Intervention planning", "Sensory diets and home programmes", "Working with schools", "Outcome measurement", "Case studies — ASD", "Case studies — ADHD", "Case studies — Sensory eating", "Ethical considerations"],
  },
];

const statusBadge = (status: string) => {
  if (status === "available") return "bg-green-50 text-green-700";
  return "bg-amber-50 text-amber-700";
};

export default function TrainingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training Portal</h1>
        <p className="mt-1 text-sm text-[oklch(0.5_0.01_260)]">
          Online courses and CPD training for schools, parents, and professionals
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: BookOpen, label: "Courses", value: courses.length },
          { icon: Users, label: "Audiences", value: "3" },
          { icon: Award, label: "CPD Accredited", value: "2" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[oklch(0.5_0.01_260)]">{s.label}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[oklch(0.955_0.015_25)]">
                  <Icon className="h-4 w-4 text-[oklch(0.637_0.237_25.331)]" />
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Course List */}
      <div className="space-y-4">
        {courses.map((course, i) => (
          <div key={i} className="rounded-2xl border border-[oklch(0.915_0.005_260)] bg-white shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[oklch(0.17_0.015_280)]">{course.title}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadge(course.status)}`}>
                      {course.status === "available" ? "Available" : "Coming Soon"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[oklch(0.5_0.01_260)]">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.audience}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration}</span>
                    <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {course.modules} modules</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[oklch(0.4_0.01_260)]">{course.description}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.5_0.01_260)]">Module Topics</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {course.topics.map((topic, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm text-[oklch(0.35_0.01_280)]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.637_0.237_25.331)]" />
                      {topic}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {course.status === "available" && (
              <div className="border-t border-[oklch(0.955_0.005_260)] bg-[oklch(0.975_0.002_260)] px-5 py-3">
                <button className="rounded-xl bg-[oklch(0.637_0.237_25.331)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[oklch(0.57_0.237_25.331)]">
                  <GraduationCap className="mr-2 inline h-4 w-4" />
                  Start Course
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
