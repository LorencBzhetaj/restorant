import { z } from "zod";

export const customerDetailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().min(6, "A valid phone number is required").max(30),
  email: z.string().trim().email("A valid email is required — we send your confirmation there").max(120),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CustomerDetailsInput = z.infer<typeof customerDetailsSchema>;

export const createReservationSchema = customerDetailsSchema.extend({
  tableId: z.string().min(1, "Select a table"),
  start: z.string().min(1),
  partySize: z.coerce.number().int().min(1).max(30),
});

export const walkInSchema = z.object({
  tableId: z.string().min(1),
  start: z.string().min(1),
  partySize: z.coerce.number().int().min(1).max(30),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().min(6, "Phone is required").max(30),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const tableSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  seats: z.coerce.number().int().min(1).max(30),
  section: z.string().trim().min(1, "Section is required").max(40),
  shape: z.enum(["square", "round", "rect"]).default("square"),
  x: z.coerce.number().int().min(0).max(11),
  y: z.coerce.number().int().min(0).max(7),
  w: z.coerce.number().int().min(1).max(4),
  h: z.coerce.number().int().min(1).max(4),
  isActive: z.boolean().default(true),
});

export const openingHourSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const closureSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().max(120).optional().or(z.literal("")),
  currency: z.string().trim().min(1).max(8),
  turnDurationMinutes: z.coerce.number().int().min(30).max(360),
  bookingInterval: z.coerce.number().int().min(15).max(120),
  seatingBuffer: z.coerce.number().int().min(0).max(120),
  maxPartySize: z.coerce.number().int().min(1).max(30),
  maxReservationsPerSlot: z.coerce.number().int().min(0).max(200),
  maxCoversPerSlot: z.coerce.number().int().min(0).max(1000),
});

export const slotLimitSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(-1).max(6), // -1 = every day
  time: z.string().regex(/^\d{2}:\d{2}$/),
  maxReservations: z.coerce.number().int().min(0).max(200),
  maxCovers: z.coerce.number().int().min(0).max(1000).optional(),
});
