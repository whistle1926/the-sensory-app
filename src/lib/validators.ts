import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const clientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  diagnosis: z.string().optional(),
  presentingConcerns: z.string().optional(),
  referrer: z.string().optional(),
  parentCarerName: z.string().optional(),
  parentCarerEmail: z.string().email().optional().or(z.literal("")),
  // Accept any ISO-3 alpha code. Runtime validation against the enabled list
  // lives in the API handlers / payment settings.
  currency: z.string().length(3).optional(),
  business: z.enum(["SENSORY_SUBMARINE", "LITTLE_SENSORY_EXPLORERS", "SENSORY_EATERS"]).default("SENSORY_SUBMARINE"),
});

export const generateReportSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  sessionDate: z.string().min(1, "Session date is required"),
  sessionNumber: z.number().int().positive("Session number must be positive"),
  rawNotes: z.string().min(10, "Session notes are too short"),
});

export const updateReportSchema = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "final"]).optional(),
  reviewDate: z.string().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SUPER_ADMIN", "TEAM_MANAGER", "CLIENT"]),
  business: z.enum(["SENSORY_SUBMARINE", "LITTLE_SENSORY_EXPLORERS", "SENSORY_EATERS"]).optional(),
});

export const submitQuizSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3)),
});
