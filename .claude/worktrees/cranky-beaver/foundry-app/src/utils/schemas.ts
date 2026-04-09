import { z } from 'zod';

export const ProfileSchema = z.object({
  name: z.string().optional(),
  age: z.union([z.number(), z.string()]).optional(),
  gender: z.string().optional(),
  weight: z.union([z.number(), z.string()]).optional(),
  experience: z.string(),
  goal: z.string().optional(),
  splitType: z.string().optional(),
  daysPerWeek: z.number().optional(),
  workoutDays: z.array(z.number()).optional(),
  mesoLength: z.number().optional(),
  startDate: z.string().optional(),
  equipment: z.string().optional(),
  sessionDuration: z.union([z.number(), z.string()]).optional(),
  autoBuilt: z.boolean().optional(),
  birthdate: z.string().optional(),
}).passthrough();

export const WorkoutSetSchema = z.object({
  weight: z.union([z.number(), z.string()]),
  reps: z.union([z.number(), z.string()]),
  rpe: z.union([z.number(), z.string()]).optional(),
  confirmed: z.boolean().optional(),
}).passthrough();

export const DayDataSchema = z.record(z.string(), z.record(z.string(), WorkoutSetSchema));

export const ReadinessEntrySchema = z.object({
  sleep: z.enum(['poor', 'ok', 'good']).optional(),
  soreness: z.enum(['high', 'moderate', 'low']).optional(),
  energy: z.enum(['low', 'moderate', 'high']).optional(),
});

export function validateProfile(data: unknown) {
  return ProfileSchema.safeParse(data);
}

export function validateDayData(data: unknown) {
  return DayDataSchema.safeParse(data);
}

export function validateReadiness(data: unknown) {
  return ReadinessEntrySchema.safeParse(data);
}
